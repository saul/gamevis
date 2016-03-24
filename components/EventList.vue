<template>
	<fieldset :disabled="all.length == 0">
		<div class="col-sm-12 event-container" v-for="event in renderOrdered()" track-by="id">
			<div class="form-group form-group-flex">
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

			<div v-if="event.type"
					 :is="event.type.component"
					 :event="event.record"
					 :all="all"
					 :available.sync="event.available"
					 :sessions="sessions"
					 :scene="scene"
					 :render-order="event.arrayIndex + 1"
					 :visible="event.visible"></div>
		</div>

		<div class="form-group clearfix">
			<div class="col-sm-12">
				<button type="button" class="btn btn-success pull-right" @click="addEvent">
					<span class="glyphicon glyphicon-plus-sign"></span>
					Add Event
				</button>
			</div>
		</div>
	</fieldset>
</template>

<script type="text/babel">
	/**
	 * Contains a list of visualisation components and filter lists.
	 * Keeps track of layer ordering and whether each layer should be rendered or not.
	 * @module components/EventList
	 *
	 * @param {GameEvent[]} all - All events from the session set
	 * @param {EventVisualisation[]} selected - Two way: Events to be visualised
	 * @param {Session[]} sessions
	 * @param {ThreeScene} scene - Three.js render scene
	 */

	/**
	 * Defines a visualisation to be used.
	 * @typedef {object} VisDefinition
	 * @global
	 * @property {string} name - Friendly name (displayed in UI)
	 * @property {string} component - Name of Vue.js component
	 */

	/**
	 * @typedef {object} EventVisualisation
	 * @global
	 * @property {GameEvent} event - Event to be visualised
	 * @property {VisDefinition} type - Visualisation type
	 * @property {GameEvent[]} available - Events that can be visualised with this visualisation.
	 * @property {boolean} visible - Should render?
	 */

	var eventUid = 0;

	export default {
		props: {
			all: {
				required: true
			},
			selected: {
				required: true,
				twoWay: true
			},
			sessions: {
				required: true,
			},
			scene: {
				required: true
			}
		},
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
			/**
			 * Add a new event visualisation to the list.
			 * @instance
			 * @memberof module:components/EventList
			 */
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

			/**
			 * Remove an event visualisation.
			 * @instance
			 * @memberof module:components/EventList
			 * @param {number} index
			 */
			removeEvent(index) {
				this.selected.splice(index, 1);
			},

			/**
			 * Toggle the visibility of an event visualisation.
			 * @instance
			 * @memberof module:components/EventList
			 * @param {number} index
			 */
			toggle(index) {
				this.selected[index].visible = !this.selected[index].visible;
			},

			/**
			 * Move an event visualisation up the render order.
			 * @instance
			 * @memberof module:components/EventList
			 * @param {number} index
			 */
			moveUp(index) {
				if (index == this.selected.length - 1) {
					return;
				}

				let event = this.selected[index];
				this.selected.splice(index, 1);
				this.selected.splice(index + 1, 0, event);
			},

			/**
			 * Move an event visualisation down the render order.
			 * @instance
			 * @memberof module:components/EventList
			 * @param {number} index
			 */
			moveDown(index) {
				if (index == 0) {
					return;
				}

				let event = this.selected[index];
				this.selected.splice(index, 1);
				this.selected.splice(index - 1, 0, event);
			},

			/**
			 * Returns this.selected in reverse (render) order.
			 * @instance
			 * @memberof module:components/EventList
			 * @returns {EventVisualisation[]}
			 */
			renderOrdered() {
				// we need to add 'arrayIndex' so we know what its index is into this.selected
				return this.selected.map((e, i) => Object.assign(e, {arrayIndex: i})).reverse();
			}
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	.event-container {
		margin-bottom: 1em;
		border-bottom: solid 2px white;
	}
</style>
