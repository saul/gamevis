<template>
	<div class="form-group">
		<div class="form-group-flex">
			<select v-model="target" @change="refreshProps" class="form-control width--auto">
				<option value="_event">Event</option>
				<option v-for="entity in event.entities" :value="entity" :selected="$index == 0">
					{{entity | capitalize}}
				</option>
			</select>

			<input class="form-control" v-el:prop-select>

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
	/**
	 * A single conditional filter.
	 * @module components/EventFilter
	 *
	 * @param {GameEvent[]} event
	 * @param {Session[]} sessions
	 */

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
					{text: '&lt;', sql: '<', cast: 'float'},
					{text: '&le;', sql: '<=', cast: 'float'},
					{text: '&gt;', sql: '>', cast: 'float'},
					{text: '&ge;', sql: '>=', cast: 'float'},
					{text: '&amp;', sql: '&', cast: 'int', condition: '!= 0'},
					{text: '!&amp;', sql: '&', cast: 'int', condition: '= 0'}
				],
				target: null,
				allProps: [],
				comparator: null,
				value: ''
			}
		},
		methods: {
			/**
			 * Represents the current conditional as a SQL query.
			 * @instance
			 * @memberof module:components/EventFilter
			 * @returns {string} SQL query
			 */
			sql() {
				// we can't use v-model on the select because select2 annoyingly doesn't
				// fire change events
				let prop = this.$els.propSelect.value;

				let query;

				if (this.target === '_event') {
					query = `(events.data->>${db.escape(prop)})::${this.comparator.cast} ${this.comparator.sql} ${db.escape(this.value)}`;
				} else {
					query = `((
              SELECT entity_props.value
              FROM entity_props
              WHERE entity_props.index = (events.entities->>${db.escape(this.target)})::int
              AND entity_props.tick <= events.tick
              AND entity_props.prop = ${db.escape(prop)}
              AND entity_props.session_id = events.session_id
              ORDER BY entity_props.tick DESC
              LIMIT 1
            )->>'value')::${this.comparator.cast} ${this.comparator.sql} ${db.escape(this.value)}`

					// if the query does not return a boolean value, we have to hard-code
					// a condition
					if (this.comparator.condition) {
						query = `(${query}) ${this.comparator.condition}`;
					}
				}

				return `AND ${query}`;
			},

			/**
			 * Update the props drop-down. Called on ready and when the target is changed.
			 * @instance
			 * @memberof module:components/EventFilter
			 */
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
			//$propSelect.select2();

			this.refreshProps();
		}
	}
</script>
