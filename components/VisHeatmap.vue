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

	<gv-event-filter-list v-ref:filters v-if="event" :event="event"></gv-event-filter-list>
</template>

<script type="text/babel">
	const _ = window.require('lodash');
	const THREE = window.require('three');
	const OverviewMesh = require('js/web/overview-mesh');

	export default {
		replace: false,
		props: ['event', 'all', 'available', 'sessions', 'scene', 'renderOrder', 'visible'],
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
			updateAvailable() {
				if (this.all) {
					this.available = this.all.filter(e => e.locations.length > 0);
				} else {
					this.available = [];
				}
			},
			clear() {
				if (this.mesh) {
					this.scene.remove(this.mesh);
				}
			},
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
			updateFilteredPoints() {
				this.filteredPoints = this.points.filter(point => {
					let [min, max] = point.session.tickRange;
					return point.tick >= min && point.tick <= max;
				});
			},
			markTextureNeedsUpdate() {
				if (!this.mesh) {
					console.warn('cannot mark heatmap texture as needsUpdate: no mesh available');
					return;
				}

				this.mesh.material.map.needsUpdate = true;
			}
		},
		events: {
			updateFrame() {
				this.heatmap.update();
				this.heatmap.display();
			},
			visualise(e) {
				let queryString = `SELECT *, (events.locations ->> :location) AS position
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

			this.$watch('gradientPath', () => {
				let image = new Image();
				image.onload = () => {
					return this.heatmap.gradientTexture.bind().upload(image);
				};
				image.src = this.gradientPath;
			});

			this.$watch('points', this.updateFilteredPoints.bind(this));

			this.$watch('filteredPoints', () => {
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
