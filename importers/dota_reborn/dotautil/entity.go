package dotautil

import (
	"errors"
	"github.com/dotabuff/manta"
	"reflect"
)

func coordFromCell(cell uint32, f float32) float32 {
	CELL_BITS := uint32(7)
	MAX_COORD_INTEGER := int32(16384)

	return float32(int32(cell*(1<<CELL_BITS))-MAX_COORD_INTEGER) + f
}

func GetEntityLocation(pe *manta.PacketEntity) (*Vector3, error) {
	cellX, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellX")
	if !found {
		return nil, errors.New("no cellX")
	}
	cellY, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellY")
	if !found {
		return nil, errors.New("no cellY")
	}
	cellZ, found := pe.FetchUint64("CBodyComponentBaseAnimatingOverlay.m_cellZ")
	if !found {
		return nil, errors.New("no cellZ")
	}
	x, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecX")
	if !found {
		return nil, errors.New("no vecX")
	}
	y, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecY")
	if !found {
		return nil, errors.New("no vecY")
	}
	z, found := pe.FetchFloat32("CBodyComponentBaseAnimatingOverlay.m_vecZ")
	if !found {
		return nil, errors.New("no vecZ")
	}

	return &Vector3{
		coordFromCell(uint32(cellX), x),
		coordFromCell(uint32(cellY), y),
		coordFromCell(uint32(cellZ), z),
	}, nil
}

func LookupEntityByPropValue(p *manta.Parser, key string, needle interface{}) (*manta.PacketEntity, bool) {
	for _, pe := range p.PacketEntities {
		val, found := pe.Fetch(key)
		if !found {
			continue
		}
		if reflect.DeepEqual(val, needle) {
			return pe, true
		}
	}
	return nil, false
}
