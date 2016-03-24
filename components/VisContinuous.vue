<template>
	<div class="checkbox">
		<label>
			<input type="checkbox" v-model="fadeOverTime"> Fade older points
		</label>
	</div>

	<div class="form-group">
		<label for="opacity" class="col-sm-4">Opacity</label>
		<div class="col-sm-8">
			<input type="text" class="form-control" id="opacity" v-model="opacity">
		</div>
	</div>

	<div v-if="event" v-show="event.locations.length > 1">
		<gv-radio-list label="Plot" :all="event.locations" :selected.sync="selectedLocation"></gv-radio-list>
	</div>

	<div v-if="event" v-show="event.entities.length > 1">
		<gv-radio-list label="Group by" :all="event.entities" :selected.sync="groupByEntity"></gv-radio-list>
	</div>

	<gv-event-filter-list v-ref:filters v-if="event" :event="event" :sessions="sessions"></gv-event-filter-list>
</template>

<script type="text/babel">
	/**
	 * Component for rendering continuous (connected line) visualisations.
	 * @module components/VisContinuous
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
	const color = window.require('./dist/components/color/one-color-all-debug');
	const faCache = require('js/web/font-awesome-cache');
	const THREE = window.require('three');
	const fs = window.require('fs');

	const TELEPORT_DISTANCE_SQ = Math.pow(256, 2);

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
				fadeOverTime: true,
				selectedLocation: null,
				groupByEntity: null,
				locations: [],
				points: [],
				sceneObjects: [],
				sessionMaterials: [],
				opacity: 1
			}
		},
		methods: {
			/**
			 * Updates `this.available` with events that have a location
			 * @instance
			 * @memberof module:components/VisContinuous
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
			 * @memberof module:components/VisContinuous
			 */
			clear() {
				this.sceneObjects.forEach(m => this.scene.remove(m));
				this.sceneObjects = [];
				this.sessionMaterials = [];
			},

			/**
			 * Recreate the scene based on `this.points`
			 * @instance
			 * @memberof module:components/VisContinuous
			 */
			updateScene() {
				this.clear();

				for (let i = 0; i < this.points.length; ++i) {
					let [session, entityPoints] = this.points[i];

					let material = new THREE.ShaderMaterial({
						uniforms: {
							useTexture: {type: 'i', value: 0},
							colour: {type: 'c', value: new THREE.Color()},
							minTick: {type: 'f', value: 0},
							maxTick: {type: 'f', value: 1},
							fadeOld: {type: 'i', value: 0},
							opacityScalar: {type: 'f', value: 1},
						},
						vertexShader: fs.readFileSync('shaders/OverviewPoint.vert', 'utf8'),
						fragmentShader: fs.readFileSync('shaders/OverviewPoint.frag', 'utf8'),
						linewidth: 2,
						depthTest: false,
						transparent: true
					});

					// keep track of this session material
					this.sessionMaterials.push({session, material});

					for (let j = 0; j < entityPoints.length; ++j) {
						let [entity, points] = entityPoints[j];

						let vertices = [];
						let ticks = [];

						for (let k = 1; k < points.length; ++k) {
							let lastPoint = points[k - 1];
							let point = points[k];

							let lastPos = lastPoint.position;
							let pos = point.position;

							// connect the points if they haven't teleported
							if (Math.pow(lastPos.x - pos.x, 2) + Math.pow(lastPos.y - pos.y, 2) + Math.pow(lastPos.z - pos.z, 2) < TELEPORT_DISTANCE_SQ) {
								vertices.push(lastPos.x, lastPos.y, lastPos.z);
								ticks.push(lastPoint.tick);

								vertices.push(pos.x, pos.y, pos.z);
								ticks.push(point.tick);
							}
						}

						// create buffered geometry
						let geometry = new THREE.BufferGeometry();
						geometry.addAttribute('position', new THREE.BufferAttribute(Float32Array.from(vertices), 3));
						geometry.addAttribute('tick', new THREE.BufferAttribute(Float32Array.from(ticks), 1));

						// create line segment object
						let line = new THREE.LineSegments(geometry, material);
						line.renderOrder = this.renderOrder;
						line.visible = this.visible;

						this.scene.add(line);
						this.sceneObjects.push(line);
					}
				}
			}
		},
		events: {
			/**
			 * @instance
			 * @memberof module:components/VisContinuous
			 * @listens updateFrame
			 */
			updateFrame() {
				for (let i = 0; i < this.sessionMaterials.length; ++i) {
					let material = this.sessionMaterials[i].material;
					let session = this.sessionMaterials[i].session;

					let [min, max] = session.tickRange;
					material.uniforms.minTick.value = min;
					material.uniforms.maxTick.value = max;

					material.uniforms.colour.value.setStyle(session.colour);
					material.uniforms.fadeOld.value = this.fadeOverTime ? 1 : 0;

					material.uniforms.opacityScalar.value = this.opacity;
				}
			},

			/**
			 * @instance
			 * @memberof module:components/VisContinuous
			 * @listens visualise
			 */
			visualise() {
				let queryString = `SELECT tick, session_id, (events.entities ->> :entity) AS entity, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id IN (:sessionIds)
          AND events.locations ? :location
          AND events.entities ? :entity
          ${this.$refs.filters.sql()}
          ORDER BY events.tick`;

				console.time(`${this.event.name} continuous query`);

				return db.query(queryString, {
						type: db.QueryTypes.SELECT,
						replacements: {
							event: this.event.name,
							sessionIds: this.sessions.map(s => s.record.id),
							location: this.selectedLocation,
							entity: this.groupByEntity
						}
					})
					.then(results => {
						console.timeEnd(`${this.event.name} continuous query`);

						let pointsBySession = _.chain(results.map(row => {
								return {
									tick: row.tick,
									entity: row.entity,
									position: JSON.parse(row.position),
									sessionIndex: this.sessions.findIndex(s => s.record.id == row.session_id)
								}
							}))
							.groupBy('sessionIndex')
							.pairs()
							.value();

						this.points = pointsBySession.map(([sessionIndex, points]) => {
							return [this.sessions[sessionIndex], _.pairs(_.groupBy(points, 'entity'))];
						});

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

			this.$watch('visible', () => {
				this.sceneObjects.forEach(o => {
					o.visible = this.visible;
				});
			});
		},
		detached() {
			this.clear();
		}
	}
</script>
