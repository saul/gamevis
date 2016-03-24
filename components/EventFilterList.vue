<template>
	<div class="clearfix">
		<label>{{all.length | pluralize 'Filter'}} ({{all.length}})</label>

		<button type="button" class="btn btn-default btn-sm pull-right" @click="add">
			<span class="glyphicon glyphicon-filter"></span>
			Add Filter
		</button>
	</div>

	<div class="col-sm-12">
		<gv-event-filter v-ref:filter v-for="filter in all" track-by="id" :sessions="sessions" :event="event" @close="remove($index)"></gv-event-filter>
	</div>
</template>

<script type="text/babel">
	/**
	 * Contains a list of {@link EventFilter} components.
	 * @module components/EventFilterList
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
				atomicId: 0,
				all: []
			}
		},
		methods: {
			/**
			 * Add a filter to the list.
			 * @instance
			 * @memberof module:components/EventFilterList
			 */
			add() {
				this.all.push({id: this.atomicId++});
			},

			/**
			 * Remove a filter from the list.
			 * @instance
			 * @memberof module:components/EventFilterList
			 * @param {number} index
			 */
			remove(index) {
				this.all.splice(index, 1);
			},

			/**
			 * Concatenation of each filter's SQL query.
			 * @instance
			 * @memberof module:components/EventFilterList
			 * @returns {string} Complete SQL query
			 */
			sql() {
				return this.$refs.filter.map(filter => filter.sql()).join('\n');
			}
		}
	}
</script>
