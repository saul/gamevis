<template>
	<div class="clearfix">
		<label>{{all.length | pluralize 'Filter'}} ({{all.length}})</label>

		<button type="button" class="btn btn-default btn-sm pull-right" @click="add">
			<span class="glyphicon glyphicon-filter"></span>
			Add Filter
		</button>
	</div>

	<div class="col-sm-12">
		<div class="form-group-flex form-group" v-for="filter in all" track-by="id">
			<select class="form-control width--auto" v-model="filter.target">
				<option value="_event">Event</option>
				<option v-for="entity in event.entities" :value="entity" :selected="$index == 0">
					{{entity | capitalize}}
				</option>
			</select>

			<input type="text" class="form-control" v-model="filter.prop">

			<select class="form-control width--auto" v-model="filter.comparator">
				<option v-for="comparator in comparators" :value="comparator" :selected="$index == 0">
					{{{ comparator.text }}}
				</option>
			</select>

			<input type="text" class="form-control" v-model="filter.value">

			<button type="button" class="btn btn-danger" @click="remove($index)">
				<span class="glyphicon glyphicon-minus-sign"></span>
			</button>
		</div>
	</div>
</template>

<script type="text/babel">
	export default {
		props: {
			event: {
				required: true
			}
		},
		data() {
			return {
				atomicId: 0,
				all: [],
				comparators: [
					{text: '=', sql: '=', cast: 'text'},
					{text: '&ne;', sql: '!=', cast: 'text'},
					{text: '&lt;', sql: '<', cast: 'int'},
					{text: '&le;', sql: '<=', cast: 'int'},
					{text: '&gt;', sql: '>', cast: 'int'},
					{text: '&ge;', sql: '>=', cast: 'int'}
				]
			}
		},
		methods: {
			add() {
				this.all.push({
					id: this.atomicId++,
					target: null,
					prop: '',
					comparator: null,
					value: ''
				});
			},
			remove(index) {
				this.all.splice(index, 1);
			},
			sql() {
				return this.all.map(filter => {
						if (filter.target === '_event') {
							return `AND (events.data->>${db.escape(filter.prop)})::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
						}

						return `AND ((
              SELECT entity_props.value
              FROM entity_props
              WHERE entity_props.index = (events.entities->>${db.escape(filter.target)})::int
              AND entity_props.tick <= events.tick
              AND entity_props.prop = ${db.escape(filter.prop)}
              AND entity_props.session_id = events.session_id
              ORDER BY entity_props.tick DESC
              LIMIT 1
            )->>'value')::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
					})
					.join('\n');
			}
		}
	}
</script>
