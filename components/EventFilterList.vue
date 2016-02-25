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
			add() {
				this.all.push({id: this.atomicId++});
			},
			remove(index) {
				this.all.splice(index, 1);
			},
			sql() {
				return this.$refs.filter.map(filter => filter.sql()).join('\n');
			}
		}
	}
</script>
