package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
	"github.com/lib/pq"
	"log"
	"os"
	"reflect"
	"strings"
	"sync"
)

type PropValueVector struct {
	X float32 `json:"x"`
	Y float32 `json:"y"`
	Z float32 `json:"z"`
}

type PropValueColumn struct {
	Value interface{} `json:"value"`
}

type EventRow struct {
	Tick     uint32
	Name     string
	Data     interface{}
	Entities interface{}
}

type BufferedPropUpdate struct {
	Tick  uint32
	Value interface{}
}

type EntityPropMap map[int32]map[string]BufferedPropUpdate

type BufferedUpdates struct {
	Entities EntityPropMap
	WG       sync.WaitGroup
}

func (u *BufferedUpdates) Buffer(index int32, prop string, tick uint32, value interface{}) {
	entity, found := u.Entities[index]

	if found {
		entity[prop] = BufferedPropUpdate{tick, value}
	} else {
		u.Entities[index] = map[string]BufferedPropUpdate{prop: BufferedPropUpdate{tick, value}}
	}
}

func (u *BufferedUpdates) Flush(sessionId int, stream *sql.Stmt) {
	if len(u.Entities) == 0 {
		return
	}

	u.WG.Add(1)

	go func(entities EntityPropMap) {
		defer u.WG.Done()

		for index, props := range entities {
			for prop, update := range props {
				jsonValue, err := json.Marshal(update.Value)
				if err != nil {
					log.Fatal(err)
				}

				_, err = stream.Exec(sessionId, index, update.Tick, prop, string(jsonValue))
				if err != nil {
					log.Fatal(err)
				}
			}
		}
	}(u.Entities)

	u.Entities = make(EntityPropMap)
}

func NewBufferedUpdates() *BufferedUpdates {
	return &BufferedUpdates{
		Entities: make(EntityPropMap),
	}
}

func coordFromCell(cell uint32, f float32) float32 {
	CELL_BITS := uint32(7)
	MAX_COORD_INTEGER := int32(16384)

	return float32(int32(cell * (1 << CELL_BITS)) - MAX_COORD_INTEGER) + f
}

func processPropChange(pe *manta.PacketEntity, prop string, value interface{}) (string, *PropValueColumn, error) {
	switch prop {
	case "CBodyComponentBaseAnimatingOverlay.m_cellX",
		"CBodyComponentBaseAnimatingOverlay.m_cellY",
		"CBodyComponentBaseAnimatingOverlay.m_cellZ",
		"CBodyComponentBaseAnimatingOverlay.m_vecX",
		"CBodyComponentBaseAnimatingOverlay.m_vecY",
		"CBodyComponentBaseAnimatingOverlay.m_vecZ":
		cellX, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellX")
		if !found {
			return "", nil, errors.New("no cellX")
		}
		cellY, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellY")
		if !found {
			return "", nil, errors.New("no cellY")
		}
		cellZ, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellZ")
		if !found {
			return "", nil, errors.New("no cellZ")
		}
		x, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecX")
		if !found {
			return "", nil, errors.New("no vecX")
		}
		y, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecY")
		if !found {
			return "", nil, errors.New("no vecY")
		}
		z, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecZ")
		if !found {
			return "", nil, errors.New("no vecZ")
		}

		vec := PropValueVector{
			coordFromCell(uint32(cellX), x),
			coordFromCell(uint32(cellY), y),
			coordFromCell(uint32(cellZ), z),
		}

		return "position", &PropValueColumn{
			vec,
		}, nil
	default:
		return prop, &PropValueColumn{value}, nil
	}
}

func main() {
	path := os.Args[1]

	parser, err := manta.NewParserFromFile(path)
	if err != nil {
		panic(err)
	}

	db, err := sql.Open("postgres", "postgres://gamevis:gamevis@localhost/gamevis?sslmode=disable")
	if err != nil {
		panic(err)
	}

	txn, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}

	var sessionId int
	var propStream *sql.Stmt
	var events []*EventRow

	skipProps := map[string]bool{
		"m_iCursor.0000":                                          true,
		"m_iCursor.0001":                                          true,
		"m_anglediff":                                             true,
		"m_NetworkActivity":                                       true,
		"CBodyComponentBaseAnimatingOverlay.m_nNewSequenceParity": true,
		"CBodyComponentBaseAnimatingOverlay.m_nResetEventsParity": true,
		"m_NetworkSequenceIndex":                                  true,
		"CBodyComponentBaseAnimatingOverlay.m_flPlaybackRate":     true,
		"CDOTAGamerules.m_iFoWFrameNumber":                        true,
	}
	entities := make(map[int32](*manta.Properties))
	updates := NewBufferedUpdates()
	lastFlush := uint32(0)
	ENTITY_UPDATE_BUFFER_TICKS := uint32(15) // accumulate buffer updates for `n` ticks before flushing

	parser.Callbacks.OnCDemoFileHeader(func(header *dota.CDemoFileHeader) error {
		log.Println(header)

		trimmed := strings.Trim(*header.DemoFileStamp, "\x00")
		header.DemoFileStamp = &trimmed

		jsonHeader, err := json.Marshal(header)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Print("Creating session...")
		err = txn.QueryRow("INSERT INTO sessions (title, level, game, data) VALUES ($1, $2, $3, $4) RETURNING id", header.GetServerName(), header.GetMapName(), "dota_reborn", jsonHeader).Scan(&sessionId)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok", sessionId)

		fmt.Print("Opening entity props stream...")
		propStream, err = txn.Prepare(pq.CopyIn("entity_props", "session_id", "index", "tick", "prop", "value") + " WITH NULL 'null'")
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		return nil
	})

	parser.Callbacks.OnCMsgDOTACombatLogEntry((func(cle *dota.CMsgDOTACombatLogEntry) error {
		row := &EventRow{
			Tick: parser.Tick,
			Name: strings.ToLower(cle.GetType().String()),
			Data: cle,
		}

		entities := make(map[string]uint32)

		if cle.GetTargetName() > 0 {
			entities["target"] = cle.GetTargetName()
		}
		if cle.GetTargetSourceName() > 0 {
			entities["target source"] = cle.GetTargetSourceName()
		}
		if cle.GetAttackerName() > 0 {
			entities["attacker"] = cle.GetAttackerName()
		}
		if cle.GetDamageSourceName() > 0 {
			entities["damage source"] = cle.GetDamageSourceName()
		}
		if cle.GetInflictorName() > 0 {
			entities["inflictor"] = cle.GetInflictorName()
		}

		if len(entities) > 0 {
			row.Entities = entities
		}

		events = append(events, row)
		return nil
	}))

	parser.OnPacketEntity(func(pe *manta.PacketEntity, event manta.EntityEventType) error {
		if event == manta.EntityEventType_Create {
			properties := manta.NewProperties()
			entities[pe.Index] = properties
		} else if event != manta.EntityEventType_Update {
			return nil
		}

		// flush buffered updates if enough ticks have passed
		if (parser.Tick - lastFlush) > ENTITY_UPDATE_BUFFER_TICKS || lastFlush > parser.Tick {
			updates.Flush(sessionId, propStream)
			lastFlush = parser.Tick
		}

		for prop, value := range pe.Properties.KV {
			// skip uninteresting props which change often
			if _, skip := skipProps[prop]; skip {
				continue
			}

			oldValue, found := entities[pe.Index].Fetch(prop)

			if found && reflect.DeepEqual(value, oldValue) {
				continue
			}

			dbProp, dbValue, err := processPropChange(pe, prop, value)
			if err != nil {
				log.Fatal(err)
			}

			updates.Buffer(pe.Index, dbProp, parser.Tick, dbValue)

			// merge
			entities[pe.Index].KV[prop] = value
		}

		return nil
	})

	parser.AfterStopCallback = func() {
		fmt.Print("Final flush...")
		updates.Flush(sessionId, propStream)
		fmt.Println("ok")

		fmt.Print("Waiting writer routines to complete...")
		updates.WG.Wait()
		fmt.Println("ok")

		fmt.Print("Finalising entity prop stream...")
		_, err = propStream.Exec()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		fmt.Print("Closing entity prop stream...")
		err = propStream.Close()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		fmt.Print("Opening events stream...")
		eventStream, err := txn.Prepare(pq.CopyIn("events", "session_id", "tick", "name", "data", "entities") + " WITH NULL 'null'")
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		for _, event := range events {
			dataJson, err := json.Marshal(event.Data)
			if err != nil {
				log.Fatal(err)
			}

			entitiesJson, err := json.Marshal(event.Entities)
			if err != nil {
				log.Fatal(err)
			}

			_, err = eventStream.Exec(sessionId, event.Tick, event.Name, string(dataJson), string(entitiesJson))
			if err != nil {
				log.Fatal(err)
			}
		}

		fmt.Print("Finalising event stream...")
		_, err = eventStream.Exec()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		fmt.Print("Closing event stream...")
		err = eventStream.Close()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		fmt.Print("Committing transaction...")
		err = txn.Commit()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")
	}

	parser.Start()
}
