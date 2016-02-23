<template>
	<fieldset :disabled="all.length == 0">
		<div v-for="event in selected" track-by="id">
			<div class="form-group-flex form-group">
				<select class="form-control width--inherit" v-model="event.type">
					<option v-for="type in types" :value="type" :selected="$index == 0">
						{{type.name | capitalize}}
					</option>
				</select>

				<select class="form-control" v-model="event.record">
					<option v-for="event in event.available" :value="event" :selected="$index == 0" :track-by="event.name">
						{{event.name}}
					</option>
				</select>

				<button type="button" class="btn btn-danger" @click="removeEvent($index)">
					<span class="glyphicon glyphicon-minus-sign"></span>
				</button>
			</div>

			<div class="gutter--left gutter--bottom"
					 v-if="event.type"
					 :is="event.type.component"
					 :event="event.record"
					 :all="all"
					 :available.sync="event.available"
					 :sessions="sessions"
					 :scene="scene"></div>
		</div>

		<div class="form-group clearfix">
			<button type="button" class="btn btn-default pull-right" @click="addEvent">
				<span class="glyphicon glyphicon-plus-sign"></span>
			</button>
		</div>
	</fieldset>
</template>

<script type="text/babel">
	var eventUid = 0;

	export default {
		props: ['all', 'selected', 'sessions', 'scene'],
		data() {
			return {
				types: [
					{
						name: 'continuous',
						component: 'gv-timeline-event-continuous'
					},
					{
						name: 'discontinuous',
						component: 'gv-timeline-event-discontinuous'
					},
					{
						name: 'timeline',
						component: 'gv-timeline-event-timeline'
					}
				]
			}
		},
		methods: {
			addEvent() {
				this.selected.push({
					id: eventUid++,
					event: null,
					type: null,
					available: []
				});
			},
			removeEvent(index) {
				this.selected.splice(index, 1);
			}
		}
	}
</script>
