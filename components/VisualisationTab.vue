<template>
	<div class="row app-row__main">
		<div class="col-xs-4 main-panel__sidebar">
			<form class="form-horizontal">
				<div class="form-group">
					<label class="col-sm-4">Title</label>
					<div class="col-sm-8">
						<input type="text" class="form-control" v-model="title">
					</div>
				</div>

				<div class="form-group">
					<label class="col-sm-4">Game/Level</label>
					<div class="col-sm-8">
						<gv-game-level-select class="col-sm-8" :selected.sync="gameLevel"></gv-game-level-select>
					</div>
				</div>

				<div class="form-group">
					<label class="col-sm-12">Sessions</label>

					<div class="col-sm-12">
						<gv-session-select :selected.sync="sessions" :game-level="gameLevel" :events.sync="allEvents"></gv-session-select>
					</div>
				</div>

				<label>Events</label>
				<gv-event-list :all="allEvents" :selected.sync="events" :sessions="sessions" :scene="scene"></gv-event-list>

				<div class="form-group-flex">
					<button type="submit" class="btn btn-primary btn-lg btn-block" @click.prevent="visualise" :disabled="!readyToVisualise">
						<span class="glyphicon glyphicon-eye-open"></span>
						Visualise
					</button>

					<button type="button" class="btn btn-default btn-lg" @click="save">
						<span class="glyphicon glyphicon-floppy-save"></span>
					</button>
				</div>
			</form>
		</div>

		<div class="col-xs-8">
			<gv-timeline v-ref:timeline :items="timeline.items" :groups="timeline.groups"></gv-timeline>
			<gv-webgl-renderer v-ref:renderer :scene.sync="scene" :camera.sync="camera"></gv-webgl-renderer>
		</div>
	</div>
</template>

<script type="text/babel">
	/**
	 * Component for rendering continuous (connected line) visualisations.
	 * @module components/VisualisationTab
	 *
	 * @listens render
	 * @listens postrender
	 *
	 * @param {string} title - Two way. Tab title
	 */

	/**
	 * Per-frame event for updating internal state before render.
	 *
	 * @event updateFrame
	 * @global
	 * @type {object}
	 * @property {OverviewData} overviewData - Overview data for this level
	 */

	/**
	 *
	 * @event visualise
	 * @global
	 * @type {object}
	 * @property {OverviewData} overviewData - Overview data for this level
	 */

	/**
	 * @typedef {object} OverviewData
	 * @global
	 * @property {number} pos_x - World-space X position of the top-left corner of the overview
	 * @property {number} pos_y - World-space Y position of the top-left corner of the overview
	 * @property {number} scale - Scale of the overview, e.g., 4 means 1 pixel of the overview equals 1 world-space unit.
	 */

	const db = window.db;
	const THREE = window.require('three');
	const fs = window.require('fs');
	const dialog = remote.require('dialog');
	const OverviewMesh = require('js/web/overview-mesh.js');

	/**
	 * Convert tick to milliseconds
	 * @param {number} tick - number of ticks
	 * @param {number} tickRate - ticks per second
	 * @returns {number} milliseconds
	 */
	function tickToMsecs(tick, tickRate) {
		return tick * 1000 / tickRate;
	}

	/**
	 * Convert milliseconds to tick count
	 * @param {number} msecs - time in milliseconds
	 * @param {number} tickRate - ticks per second
	 * @returns {number} ticks
	 */
	function msecsToTick(msecs, tickRate) {
		return msecs * tickRate / 1000;
	}

	export default {
		replace: false,
		props: {
			title: {
				required: true,
				twoWay: true
			}
		},
		data() {
			return {
				gameLevel: null,
				sessions: [],
				allEvents: [],
				events: [],
				overviewMesh: null,
				scene: null,
				camera: null,
				saveFrame: false,
				timeline: {
					items: [],
					groups: []
				}
			}
		},
		computed: {
			readyToVisualise() {
				return this.sessions.length > 0 && this.allEvents.length > 0 && this.events.length > 0;
			}
		},
		methods: {
			/**
			 * Broadcasts {@link event:updateFrame} to all children.
			 * @instance
			 * @memberof module:components/VisualisationTab
			 * @fires updateFrame
			 * @param {event:render} e
			 */
			render(e) {
				if (this.overviewData) {
					this.$broadcast(
						'updateFrame',
						Object.assign({}, e, {
							overviewData: this.overviewData
						})
					);
				}
			},

			/**
			 * Creates an overview quad and positions the camera.
			 * @instance
			 * @memberof module:components/VisualisationTab
			 */
			loadOverview() {
				this.overviewData = window.require(`./overviews/${this.gameLevel.game}/${this.gameLevel.level}.json`);

				// remove the existing mesh
				if (this.overviewMesh) {
					this.scene.remove(this.overviewMesh);
				}

				let loader = new THREE.TextureLoader();

				let overviewTexture = loader.load(`overviews/${this.gameLevel.game}/${this.gameLevel.level}.png`);
				let material = new THREE.MeshBasicMaterial({map: overviewTexture, depthWrite: false});

				this.overviewMesh = new OverviewMesh(this.overviewData, material);
				this.scene.add(this.overviewMesh);

				this.camera.left = this.overviewData.pos_x;
				this.camera.top = this.overviewData.pos_y;
				this.camera.right = this.overviewData.pos_x + (1024 * this.overviewData.scale);
				this.camera.bottom = this.overviewData.pos_y - (1024 * this.overviewData.scale);
				this.camera.updateProjectionMatrix();
			},

			/**
			 * Adds items and groups to the timeline.
			 * @instance
			 * @memberof module:components/VisualisationTab
			 */
			visualiseTimeline() {
				this.timeline.items = this.sessions.map((session, index) => {
					return {
						session,
						id: -index,
						content: 'Time range',
						group: session.record.id,
						start: tickToMsecs(session.tickRange[0], session.record.tickrate),
						end: tickToMsecs(session.tickRange[1], session.record.tickrate)
					}
				});

				this.timeline.groups = this.sessions.map(session => {
					return {
						id: session.record.id,
						content: session.record.title,
						style: `background-color: ${session.colour}`
					}
				});

				let eventNames = this.events.filter(e => e.type.name == 'timeline').map(e => e.record.name);

				// if there are no events to visualise, nothing to query
				if (eventNames.length === 0) {
					return;
				}

				let queryString = `SELECT * FROM events WHERE events.name IN (:eventNames) AND events.session_id IN (:sessionIds)`;

				db.query(queryString, {
						type: db.QueryTypes.SELECT,
						replacements: {
							eventNames,
							sessionIds: this.sessions.map(s => s.record.id),
						}
					})
					.then(results => {
						this.timeline.items = this.timeline.items.concat(results.map(row => {
							let session = this.sessions.find(s => s.record.id == row.session_id)

							return {
								id: row.id,
								content: row.name,
								group: row.session_id,
								editable: false,
								start: tickToMsecs(row.tick, session.record.tickrate)
							}
						}));
					})
					.catch(err => this.$dispatch('error', err));
			},

			/**
			 * Called by UI when "Visualise" button is clicked to trigger visualisation components to run.
			 * @instance
			 * @memberof module:components/VisualisationTab
			 * @fires visualise
			 */
			visualise() {
				this.visualiseTimeline();
				this.$broadcast('visualise', {overviewData: this.overviewData});
			},

			/**
			 * Store a snapshot at the next {@link event:postrender}
			 * @instance
			 * @memberof module:components/VisualisationTab
			 */
			save() {
				this.saveFrame = true;
			}
		},
		ready() {
			this.$watch('gameLevel', this.loadOverview.bind(this));

			this.$refs.renderer.$on('render', this.render.bind(this));

			// we need to save on `postrender` otherwise the buffer is black
			this.$refs.renderer.$on('postrender', () => {
				if (!this.saveFrame) {
					return;
				}

				this.saveFrame = false;

				let data = this.$refs.renderer.toDataURL('image/png');

				dialog.showSaveDialog(remote.getCurrentWindow(), {
					title: 'Save visualisation',
					filters: [
						{name: 'PNG', extensions: ['png']},
					]
				}, filename => {
					if (!filename) {
						return;
					}

					// data is a data URI (base64 encoded)
					let b64 = data.replace(/^data:image\/png;base64,/, '');
					fs.writeFileSync(filename, b64, 'base64');
				});
			});

			this.$refs.timeline.$on('moving', (item, cb) => {
				// update the tick range for this session
				item.session.tickRange = [
					msecsToTick(item.start, item.session.record.tickrate),
					msecsToTick(item.end, item.session.record.tickrate)
				];

				cb(item);
			});
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	@import "../less/variables.less";

	.app-row__main {
		display: flex;
		min-height: 100vh;

		> div {
			padding: 1em;
		}
	}

	.main-panel__sidebar {
		background-color: @gray-lighter;
		min-width: 400px;

		hr {
			border-top: solid 2px white;
		}
	}
</style>
