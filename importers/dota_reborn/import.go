package main

import (
	"./dotautil"
	"database/sql"
	"encoding/json"
	"fmt"
	"github.com/dotabuff/manta"
	"github.com/dotabuff/manta/dota"
	"github.com/lib/pq"
	"log"
	"math"
	"os"
	"reflect"
	"strings"
)

type PropValueColumn struct {
	Value interface{} `json:"value"`
}

type EventRow struct {
	Tick      uint32
	Name      string
	Data      interface{}
	Locations interface{}
	Entities  interface{}
}

func round(f float64) int {
	if math.Abs(f) < 0.5 {
		return 0
	}
	return int(f + math.Copysign(0.5, f))
}

func processPropChange(pe *manta.PacketEntity, prop string, value interface{}) (string, *PropValueColumn, error) {
	switch prop {
	case "CBodyComponentBaseAnimatingOverlay.m_cellX",
		"CBodyComponentBaseAnimatingOverlay.m_cellY",
		"CBodyComponentBaseAnimatingOverlay.m_cellZ",
		"CBodyComponentBaseAnimatingOverlay.m_vecX",
		"CBodyComponentBaseAnimatingOverlay.m_vecY",
		"CBodyComponentBaseAnimatingOverlay.m_vecZ":
		vec, err := dotautil.GetEntityLocation(pe)
		if err != nil {
			return "", nil, err
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
	var tickrate int

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
	heroes := make(map[int32](*manta.PacketEntity)) // player id -> hero
	updates := dotautil.NewBufferedUpdates()
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
		err = txn.QueryRow("INSERT INTO sessions (title, level, game, data, tickrate) VALUES ($1, $2, $3, $4, 30) RETURNING id", header.GetServerName(), header.GetMapName(), "dota_reborn", jsonHeader).Scan(&sessionId)
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

	parser.Callbacks.OnCDOTAUserMsg_ChatEvent(func(ce *dota.CDOTAUserMsg_ChatEvent) error {
		row := &EventRow{
			Tick: parser.Tick,
			Name: strings.ToLower(ce.GetType().String()),
			Data: ce,
		}

		locations := make(map[string]dotautil.Vector3)
		entities := make(map[string]int32)

		processPlayerIdForEvent := func(keySuffix string, playerIdOpt *int32) {
			if playerIdOpt == nil || *playerIdOpt == -1 {
				return
			}

			playerId := *playerIdOpt

			playerEnt, found := dotautil.LookupEntityByPropValue(parser, "m_iPlayerID", playerId)
			if found {
				entities["player "+keySuffix] = playerEnt.Index
			} else {
				log.Println("unable to find player ID", playerId)
			}

			heroEnt, found := heroes[playerId]
			if found {
				entities["hero "+keySuffix] = heroEnt.Index

				loc, err := dotautil.GetEntityLocation(heroEnt)
				if err == nil {
					locations["hero "+keySuffix] = *loc
				} else {
					log.Println("getEntityLocation:", err)
				}
			} else {
				log.Println("chat event player", playerId, "has no hero")
			}
		}

		processPlayerIdForEvent("1", ce.Playerid_1)
		processPlayerIdForEvent("2", ce.Playerid_2)
		processPlayerIdForEvent("3", ce.Playerid_3)
		processPlayerIdForEvent("4", ce.Playerid_4)
		processPlayerIdForEvent("5", ce.Playerid_5)
		processPlayerIdForEvent("6", ce.Playerid_6)

		if len(locations) > 0 {
			row.Locations = locations
		}

		if len(entities) > 0 {
			row.Entities = entities
		}

		events = append(events, row)
		return nil
	})

	parser.Callbacks.OnCMsgDOTACombatLogEntry((func(cle *dota.CMsgDOTACombatLogEntry) error {
		row := &EventRow{
			Tick: parser.Tick,
			Name: strings.ToLower(cle.GetType().String()),
			Data: cle,
		}

		locations := make(map[string]dotautil.Vector3)
		entities := make(map[string]int32)

		if cle.LocationX != nil && cle.LocationY != nil {
			locations["event"] = dotautil.Vector3{cle.GetLocationX(), cle.GetLocationY(), 0}
		}

		if cle.EventLocation != nil {
			playerId := int32(cle.GetEventLocation())

			playerEnt, found := dotautil.LookupEntityByPropValue(parser, "m_iPlayerID", playerId)
			if found {
				entities["player"] = playerEnt.Index
			} else {
				log.Println("event referring to non-existent player ID")
			}

			heroEnt, found := heroes[playerId]
			if found {
				loc, err := dotautil.GetEntityLocation(heroEnt)

				if err == nil {
					locations["hero"] = *loc
				} else {
					log.Println("getEntityLocation: ", err)
				}
			} else {
				log.Println("combat log player", playerId, "has no hero")
			}
		}

		if len(locations) > 0 {
			row.Locations = locations
		}

		if len(entities) > 0 {
			row.Entities = entities
		}

		events = append(events, row)
		return nil
	}))

	parser.Callbacks.OnCDemoFileInfo(func(fi *dota.CDemoFileInfo) error {
		tickrate = round(float64(fi.GetPlaybackTicks()) / float64(fi.GetPlaybackTime()))
		return nil
	})

	const MAX_CLIENTS = 64
	const NUM_ENT_ENTRY_BITS = 14
	const NUM_ENT_ENTRIES = 1 << NUM_ENT_ENTRY_BITS
	const ENT_ENTRY_MASK = NUM_ENT_ENTRIES - 1

	parser.OnPacketEntity(func(pe *manta.PacketEntity, event manta.EntityEventType) error {
		if pe.ClassName != "CDOTA_PlayerResource" {
			return nil
		}

		for i := int32(0); i < MAX_CLIENTS; i++ {
			heroProp := fmt.Sprintf("m_vecPlayerTeamData.%04d.m_hSelectedHero", i)
			heroHandle, found := pe.FetchUint32(heroProp)
			if !found {
				continue
			}

			heroEntry := heroHandle & ENT_ENTRY_MASK
			if heroEntry == ENT_ENTRY_MASK {
				continue
			}

			heroEnt, found := parser.PacketEntities[int32(heroEntry)]
			if !found {
				log.Fatal("could not find entity pointed by handle")
			}

			heroes[i] = heroEnt
		}

		return nil
	})

	parser.OnPacketEntity(func(pe *manta.PacketEntity, event manta.EntityEventType) error {
		if event == manta.EntityEventType_Create {
			properties := manta.NewProperties()
			entities[pe.Index] = properties
		} else if event != manta.EntityEventType_Update {
			return nil
		}

		// flush buffered updates if enough ticks have passed
		if (parser.Tick-lastFlush) > ENTITY_UPDATE_BUFFER_TICKS || lastFlush > parser.Tick {

			// loop through all of the updates and map 'position' to movement events
			for index, props := range updates.Entities {
				// has this entity's position changed?
				update, found := props["position"]
				if !found {
					continue
				}

				// is this entity a hero?
				controllingPlayer := int32(-1)
				for playerId, ent := range heroes {
					if ent.Index == index {
						controllingPlayer = playerId
						break
					}
				}
				if controllingPlayer < 0 {
					continue
				}

				playerEnt, found := dotautil.LookupEntityByPropValue(parser, "m_iPlayerID", controllingPlayer)
				if !found {
					panic("unable to find player ID")
				}

				// due to Go's very strong typing, this is the nicest way to
				// unbox the new position value
				pos, ok := (update.Value.(*PropValueColumn)).Value.(*dotautil.Vector3)
				if !ok {
					panic("position was not a Vector3")
				}

				row := &EventRow{
					Tick: update.Tick,
					Name: "hero_move",
					Locations: map[string]dotautil.Vector3{
						"hero": *pos,
					},
					Entities: map[string]int32{
						"hero":   index,
						"player": playerEnt.Index,
					},
					Data: map[string]interface{}{
						"playerid": controllingPlayer,
					},
				}

				events = append(events, row)
			}

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
		eventStream, err := txn.Prepare(pq.CopyIn("events", "session_id", "tick", "name", "data", "locations", "entities") + " WITH NULL 'null'")
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")

		for _, event := range events {
			dataJson, err := json.Marshal(event.Data)
			if err != nil {
				log.Fatal(err)
			}

			locationsJson, err := json.Marshal(event.Locations)
			if err != nil {
				log.Fatal(err)
			}

			entitiesJson, err := json.Marshal(event.Entities)
			if err != nil {
				log.Fatal(err)
			}

			_, err = eventStream.Exec(sessionId, event.Tick, event.Name, string(dataJson), string(locationsJson), string(entitiesJson))
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

		fmt.Print("Updating tickrate...")
		_, err = txn.Exec("UPDATE sessions SET tickrate=$1 WHERE id=$2", tickrate, sessionId)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok", tickrate)

		fmt.Print("Committing transaction...")
		err = txn.Commit()
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println("ok")
	}

	parser.Start()
}
