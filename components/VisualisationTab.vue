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
	const db = window.db;
	const THREE = window.require('three');
	const fs = window.require('fs');
	const dialog = remote.require('dialog');
	const OverviewMesh = require('js/web/overview-mesh.js');

	function tickToMsecs(tick) {
		// TODO: replace 128 with actual tickrate!!
		return tick * 1000 / 128;
	}

	function msecsToTick(msecs) {
		// TODO: replace 128 with actual tickrate!!
		return msecs * 128 / 1000;
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
			visualiseTimeline() {
				this.timeline.items = this.sessions.map((session, index) => {
					return {
						session,
						id: -index,
						content: 'Time range',
						group: session.record.id,
						start: tickToMsecs(session.tickRange[0]),
						end: tickToMsecs(session.tickRange[1])
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
							return {
								id: row.id,
								content: row.name,
								group: row.session_id,
								editable: false,
								start: tickToMsecs(row.tick)
							}
						}));
					})
					.catch(err => this.$dispatch('error', err));
			},
			visualise() {
				this.visualiseTimeline();
				this.$broadcast('visualise', {overviewData: this.overviewData});

				this.$refs.timeline.$on('moving', (item, cb) => {
					item.session.tickRange = [item.start, item.end].map(msecsToTick);
					cb(item);
				});
			},
			save() {
				this.saveFrame = true;
			}
		},
		ready() {
			this.$watch('gameLevel', this.loadOverview.bind(this));

			this.$refs.renderer.$on('render', this.render.bind(this));

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

					let b64 = data.replace(/^data:image\/png;base64,/, '');
					fs.writeFileSync(filename, b64, 'base64');
				});
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
