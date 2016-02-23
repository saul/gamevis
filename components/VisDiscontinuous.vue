<template>
	<div class="checkbox">
		<label>
			<input type="checkbox" v-model="fadeOverTime"> Fade older points
		</label>
	</div>

	<gv-radio-list v-if="event" label="Plot" :all="event.locations" :selected.sync="selectedLocation"></gv-radio-list>

	<div class="form-group form-group-flex">
		<label>Icon</label>
		<iconpicker :value.sync="iconClass" class="input-sm"></iconpicker>
	</div>

	<gv-event-filter-list v-ref:filters v-if="event" :event="event"></gv-event-filter-list>
</template>

<script type="text/babel">
	const _ = window.require('lodash');
	const THREE = window.require('three');
	const fs = window.require('fs');
	const faCache = require('js/web/font-awesome-cache');

	export default {
		replace: false,
		props: ['event', 'all', 'available', 'sessions', 'scene', 'renderOrder'],
		data() {
			return {
				iconClass: 'fa-crosshairs',
				selectedLocation: null,
				locations: [],
				pointsBySession: [],
				sceneObjects: [],
				sessionMaterials: [],
				fadeOverTime: false
			}
		},
		computed: {
			iconText() {
				return faCache.get(this.iconClass);
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
				this.sceneObjects.forEach(m => this.scene.remove(m));
				this.sceneObjects = [];
				this.sessionMaterials = [];
			},
			updateScene() {
				this.clear();

				let canvas = document.createElement('canvas');
				canvas.width = canvas.height = 64;

				// render the icon to a 2D canvas
				let ctx = canvas.getContext('2d');
				ctx.font = '64px FontAwesome';
				ctx.textBaseline = 'top';
				ctx.fillStyle = 'white';
				ctx.fillText(this.iconText, 0, 0);

				let texture = new THREE.Texture(canvas);
				texture.needsUpdate = true;

				for (let i = 0; i < this.pointsBySession.length; ++i) {
					let [session, points] = this.pointsBySession[i];

					let material = new THREE.ShaderMaterial({
						uniforms: {
							useTexture: {type: 'i', value: 1},
							texture1: {type: 't', value: texture},
							colour: {type: 'c', value: new THREE.Color()},
							minTick: {type: 'f', value: 0},
							maxTick: {type: 'f', value: 1},
							fadeOld: {type: 'i', value: 0},
						},
						vertexShader: fs.readFileSync('shaders/OverviewPoint.vert', 'utf8'),
						fragmentShader: fs.readFileSync('shaders/OverviewPoint.frag', 'utf8'),
						transparent: true,
						depthTest: false
					});

					// keep track of this session material
					this.sessionMaterials.push({session, material});

					let geometry = new THREE.Geometry();
					let ticks = [];

					for (let j = 0; j < points.length; ++j) {
						let point = points[j];
						let pos = point.position;

						geometry.merge(
							new THREE.PlaneGeometry(128, 128),
							new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z)
						);

						// add the tick to each vertex of the quad
						ticks.push(point.tick, point.tick, point.tick, point.tick, point.tick, point.tick);
					}

					let bufferGeometry = new THREE.BufferGeometry();
					bufferGeometry.fromGeometry(geometry);
					bufferGeometry.addAttribute('tick', new THREE.BufferAttribute(Float32Array.from(ticks), 1));

					let mesh = new THREE.Mesh(bufferGeometry, material);
					mesh.renderOrder = this.renderOrder;

					this.scene.add(mesh);
					this.sceneObjects.push(mesh);
				}
			},
		},
		events: {
			updateFrame() {
				for (let i = 0; i < this.sessionMaterials.length; ++i) {
					let material = this.sessionMaterials[i].material;
					let session = this.sessionMaterials[i].session;

					let [min, max] = session.tickRange;
					material.uniforms.minTick.value = min;
					material.uniforms.maxTick.value = max;

					material.uniforms.colour.value.setStyle(session.colour);
					material.uniforms.fadeOld.value = this.fadeOverTime ? 1 : 0;
				}
			},
			visualise() {
				let queryString = `SELECT *, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id IN (:sessionIds)
          AND events.locations ? :location
          ${this.$refs.filters.sql()}`;

				console.time(`${this.event.name} discontinuous query`);

				return db.query(queryString, {
						type: db.QueryTypes.SELECT,
						replacements: {
							event: this.event.name,
							sessionIds: this.sessions.map(s => s.record.id),
							location: this.selectedLocation
						}
					})
					.then(results => {
						console.timeEnd(`${this.event.name} discontinuous query`);

						let pointsBySession = _.chain(results.map(row => {
								return {
									tick: row.tick,
									position: JSON.parse(row.position),
									sessionIndex: this.sessions.findIndex(s => s.record.id == row.session_id)
								}
							}))
							.groupBy('sessionIndex')
							.pairs()
							.value();

						this.pointsBySession = pointsBySession.map(([sessionIndex, points]) => [this.sessions[sessionIndex], points]);

						this.updateScene();
					})
					.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.$watch('all', this.updateAvailable.bind(this));
			this.updateAvailable();

			this.$watch('renderOrder', () => {
				this.sceneObjects.forEach(o => {
					o.renderOrder = this.renderOrder;
				});
			});
		},
		detached() {
			this.clear();
		}
	}
</script>
