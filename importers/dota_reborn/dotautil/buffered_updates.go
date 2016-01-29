package dotautil

import (
	"database/sql"
	"encoding/json"
	"log"
	"sync"
)

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
