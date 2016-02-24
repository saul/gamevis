<template>
	<fieldset :disabled="all.length == 0">
		<div v-for="event in renderOrdered()" track-by="id">
			<div class="form-group-flex form-group">
				<button type="button" class="btn btn-default btn-xs" @click="moveUp(event.arrayIndex)" :disabled="$index == 0">
					<span class="glyphicon glyphicon-chevron-up"></span>
				</button>

				<button type="button" class="btn btn-default btn-xs" @click="moveDown(event.arrayIndex)" :disabled="$index == selected.length - 1">
					<span class="glyphicon glyphicon-chevron-down"></span>
				</button>

				<button type="button" class="btn btn-default btn-xs" @click="toggle(event.arrayIndex)">
					<span class="glyphicon" :class="{'glyphicon-eye-open': event.visible, 'glyphicon-eye-close': !event.visible}"></span>
				</button>

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

				<button type="button" class="btn btn-danger" @click="removeEvent(event.arrayIndex)">
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
					 :scene="scene"
					 :render-order="event.arrayIndex + 1"
					 :visible="event.visible"></div>
			<hr>
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
						name: 'heatmap',
						component: 'gv-vis-heatmap'
					},
					{
						name: 'continuous',
						component: 'gv-vis-continuous'
					},
					{
						name: 'discontinuous',
						component: 'gv-vis-discontinuous'
					},
					{
						name: 'timeline',
						component: 'gv-vis-timeline'
					}
				]
			}
		},
		methods: {
			addEvent() {
				this.selected.unshift({
					id: eventUid++,
					event: null,
					type: null,
					available: [],
					arrayIndex: null,
					visible: true
				});
			},
			removeEvent(index) {
				this.selected.splice(index, 1);
			},
			toggle(index) {
				this.selected[index].visible = !this.selected[index].visible;
			},
			moveUp(index) {
				if (index == this.selected.length - 1) {
					return;
				}

				let event = this.selected[index];
				this.selected.splice(index, 1);
				this.selected.splice(index + 1, 0, event);
			},
			moveDown(index) {
				if (index == 0) {
					return;
				}

				let event = this.selected[index];
				this.selected.splice(index, 1);
				this.selected.splice(index - 1, 0, event);
			},
			renderOrdered() {
				// render order is the reverse order of this.selected
				// we need to add 'arrayIndex' so we know what its index is into this.selected
				return this.selected.map((e, i) => Object.assign(e, {arrayIndex: i})).reverse();
			}
		}
	}
</script>
