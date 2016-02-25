<template>
	<div class="form-group">
		<div class="form-group-flex">
			<select v-model="target" @change="refreshProps" class="form-control width--auto">
				<option value="_event">Event</option>
				<option v-for="entity in event.entities" :value="entity" :selected="$index == 0">
					{{entity | capitalize}}
				</option>
			</select>

			<select v-el:prop-select class="width--100pc" :disabled="allProps.length == 0">
				<option v-for="p in allProps" :value="p">{{p}}</option>
			</select>

			<button type="button" class="btn btn-danger" @click="$emit('close')">
				<span class="glyphicon glyphicon-minus-sign"></span>
			</button>
		</div>

		<div class="form-group-flex">
			<select v-model="comparator" class="form-control width--auto">
				<option v-for="cmp in comparators" :value="cmp" :selected="$index == 0">
					{{{ cmp.text }}}
				</option>
			</select>

			<input v-model="value" type="text" class="form-control">
		</div>
	</div>
</template>

<script type="text/babel">
	export default {
		props: {
			event: {
				required: true
			},
			sessions: {
				required: true
			}
		},
		data() {
			return {
				comparators: [
					{text: '=', sql: '=', cast: 'text'},
					{text: '&ne;', sql: '!=', cast: 'text'},
					{text: '&lt;', sql: '<', cast: 'int'},
					{text: '&le;', sql: '<=', cast: 'int'},
					{text: '&gt;', sql: '>', cast: 'int'},
					{text: '&ge;', sql: '>=', cast: 'int'}
				],
				target: null,
				allProps: [],
				comparator: null,
				value: ''
			}
		},
		methods: {
			sql() {
				// we can't use v-model on the select because select2 annoyingly doesn't
				// fire change events
				let prop = this.$els.propSelect.value;

				if (this.target === '_event') {
					return `AND (events.data->>${db.escape(prop)})::${this.comparator.cast} ${this.comparator.sql} ${db.escape(this.value)}`;
				}

				return `AND ((
              SELECT entity_props.value
              FROM entity_props
              WHERE entity_props.index = (events.entities->>${db.escape(this.target)})::int
              AND entity_props.tick <= events.tick
              AND entity_props.prop = ${db.escape(prop)}
              AND entity_props.session_id = events.session_id
              ORDER BY entity_props.tick DESC
              LIMIT 1
            )->>'value')::${this.comparator.cast} ${this.comparator.sql} ${db.escape(this.value)}`;
			},
			refreshProps() {
				this.allProps = [];

				if (this.target === '_event') {
					this.allProps = this.event.keys;
				} else {
					let queryString = `SELECT DISTINCT prop
FROM entity_props
WHERE session_id IN (:sessionIds)
AND index IN (
	SELECT DISTINCT (entities->>:target)::int AS index
	FROM events
	WHERE session_id IN (:sessionIds)
	AND name = 'player_death'
)
ORDER BY prop`;

					db.query(queryString, {
							type: db.QueryTypes.SELECT,
							replacements: {
								target: this.target,
								sessionIds: this.sessions.map(s => s.record.id)
							}
						})
						.then(results => {
							this.allProps = results.map(row => row.prop);
						})
						.catch(err => this.$dispatch('error', err));
				}
			}
		},
		ready() {
			let $propSelect = $(this.$els.propSelect);
			$propSelect.select2();

			this.refreshProps();
		}
	}
</script>
