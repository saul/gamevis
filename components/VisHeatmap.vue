<template>
	<gv-heatmap-gradient-select :selected.sync="gradientPath"></gv-heatmap-gradient-select>

	<div class="form-group">
		<label for="intensity" class="col-sm-4">Point intensity</label>
		<div class="col-sm-8">
			<input type="text" class="form-control" id="intensity" v-model="intensity">
		</div>
	</div>

	<div v-if="event" v-show="event.locations.length > 1">
		<gv-radio-list label="Plot" :all="event.locations" :selected.sync="selectedLocation"></gv-radio-list>
	</div>

	<gv-event-filter-list v-ref:filters v-if="event" :event="event" :sessions="sessions"></gv-event-filter-list>
</template>

<script type="text/babel">
	/**
	 * Component for rendering heatmap visualisations.
	 * @module components/Heatmap
	 *
	 * @param {GameEvent} event
	 * @param {GameEvent[]} all - All game events for this session set
	 * @param {GameEvent[]} available - Two way. Game events that can be visualised by this component
	 * @param {Session[]} sessions
	 * @param {ThreeScene} scene - Three.js scene
	 * @param {number} renderOrder - Render order for scene objects (used for layering)
	 * @param {boolean} visible - Visualisation visible
	 */

	const _ = window.require('lodash');
	const THREE = window.require('three');
	const OverviewMesh = require('js/web/overview-mesh');

	export default {
		replace: false,
		props: {
			event: {
				required: true
			},
			all: {
				required: true
			},
			available: {
				required: true,
				twoWay: true
			},
			sessions: {
				required: true
			},
			scene: {
				required: true
			},
			renderOrder: {
				required: true
			},
			visible: {
				required: true
			},
		},
		data() {
			return {
				selectedLocation: null,
				points: [],
				filteredPoints: [],
				mesh: null,
				heatmap: null,
				intensity: 0.5,
				gradientPath: 'img/gradients/plasma.png'
			}
		},
		methods: {
			/**
			 * Updates `this.available` with events that have a location
			 * @instance
			 * @memberof module:components/VisHeatmap
			 */
			updateAvailable() {
				if (this.all) {
					this.available = this.all.filter(e => e.locations.length > 0);
				} else {
					this.available = [];
				}
			},

			/**
			 * Remove all objects from the scene.
			 * @instance
			 * @memberof module:components/VisHeatmap
			 */
			clear() {
				if (this.mesh) {
					this.scene.remove(this.mesh);
				}
			},

			/**
			 * Recreate the scene based on the available data.
			 * @instance
			 * @memberof module:components/VisHeatmap
			 * @param {OverviewData} overviewData
			 */
			updateScene(overviewData) {
				this.clear();

				let material = new THREE.MeshBasicMaterial({
					map: new THREE.Texture(this.heatmap.canvas),
					transparent: true
				});

				this.mesh = new OverviewMesh(overviewData, material);
				this.mesh.renderOrder = this.renderOrder;
				this.mesh.visible = this.visible;

				this.markTextureNeedsUpdate();

				this.scene.add(this.mesh);
			},

			/**
			 * Filter points based on its session's tick range
			 * @instance
			 * @memberof module:components/VisHeatmap
			 */
			updateFilteredPoints() {
				this.filteredPoints = this.points.filter(point => {
					let [min, max] = point.session.tickRange;
					return point.tick >= min && point.tick <= max;
				});
			},

			/**
			 * Inform Three.js to reupload the texture to the GPU.
			 * @instance
			 * @memberof module:components/VisHeatmap
			 */
			markTextureNeedsUpdate() {
				if (!this.mesh) {
					console.warn('cannot mark heatmap texture as needsUpdate: no mesh available');
					return;
				}

				this.mesh.material.map.needsUpdate = true;
			}
		},
		events: {
			/**
			 * @instance
			 * @memberof module:components/VisHeatmap
			 * @listens updateFrame
			 */
			updateFrame() {
				this.heatmap.update();
				this.heatmap.display();
			},

			/**
			 * @instance
			 * @memberof module:components/VisHeatmap
			 * @listens visualise
			 */
			visualise(e) {
				let queryString = `SELECT session_id, tick, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id IN (:sessionIds)
          AND events.locations ? :location
          ${this.$refs.filters.sql()}`;

				console.time(`${this.event.name} heatmap query`);

				return db.query(queryString, {
						type: db.QueryTypes.SELECT,
						replacements: {
							event: this.event.name,
							sessionIds: this.sessions.map(s => s.record.id),
							location: this.selectedLocation
						}
					})
					.then(results => {
						console.timeEnd(`${this.event.name} heatmap query`);

						this.points = results.map(row => {
							let position = JSON.parse(row.position);

							return {
								x: (position.x - e.overviewData.pos_x) / e.overviewData.scale,
								y: (e.overviewData.pos_y - position.y) / e.overviewData.scale,
								scale: e.overviewData.scale,
								intensity: this.intensity,
								tick: row.tick,
								session: this.sessions.find(s => s.record.id == row.session_id)
							};
						});

						this.updateScene(e.overviewData);
					})
					.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.$watch('all', this.updateAvailable.bind(this));
			this.updateAvailable();

			this.heatmap = createWebGLHeatmap({
				canvas: document.createElement('canvas'),
				intensityToAlpha: true,
				gradientTexture: this.gradientPath,
				width: 1024,
				height: 1024
			});

			// watch `sessions` for change (we're interested in tickRange in particular)
			// debounce re-filtering as it triggers repopulating vertex buffers (slow)
			this.$watch(
				'sessions',
				_.debounce(this.updateFilteredPoints.bind(this), 250, {maxWait: 300}),
				{deep: true}
			);

			// when the gradient path changes, reupload the texture to the GPU
			this.$watch('gradientPath', () => {
				let image = new Image();
				image.onload = () => {
					return this.heatmap.gradientTexture.bind().upload(image);
				};
				image.src = this.gradientPath;
			});

			this.$watch('points', this.updateFilteredPoints.bind(this));

			this.$watch('filteredPoints', () => {
				// update the heatmap with the new points
				this.heatmap.clear();
				this.heatmap.addPoints(this.filteredPoints);

				// the heatmap texture has changed so mark it as dirty
				this.markTextureNeedsUpdate();
			});

			this.$watch('renderOrder', () => {
				if (this.mesh) {
					this.mesh.renderOrder = this.renderOrder;
				}
			});

			this.$watch('visible', () => {
				if (this.mesh) {
					this.mesh.visible = this.visible;
				}
			});
		},
		detached() {
			this.clear();
		}
	}
</script>
