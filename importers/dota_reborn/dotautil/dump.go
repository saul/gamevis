package dotautil

import (
	"fmt"
	"github.com/dotabuff/manta"
)

func DumpStringTables(p *manta.Parser) {
	fmt.Println("\nSTRING TABLES")

	for _, table := range p.StringTables.Tables {
		fmt.Println("*** ", table.GetName())

		for _, val := range table.Items {
			fmt.Printf("#%03d: %s = %v\n", val.Index, val.Key, val.Value)
		}
	}
}

func DumpEntities(p *manta.Parser) {
	fmt.Println("\nENTITIES")

	for _, pe := range p.PacketEntities {
		fmt.Printf("#%03d %s", pe.Index, pe.ClassName)

		fmt.Println("Baseline:")
		for k, v := range pe.ClassBaseline.KV {
			fmt.Println("  ", k, "=", v)
		}

		fmt.Println("Properties:")
		for k, v := range pe.Properties.KV {
			fmt.Println("  ", k, "=", v)
		}
	}
}
