<template>
	<div class="checkbox">
		<label>
			<input type="checkbox" v-model="fadeOverTime"> Fade older points
		</label>
	</div>

	<div v-if="event" class="form-group">
		<label>Plot</label>

		<div class="radio" v-for="location in event.locations">
			<label>
				<input type="radio" v-model="selectedLocation" :value="location" :checked="$index == 0">
				{{location | capitalize}}
			</label>
		</div>
	</div>

	<div v-if="event" class="form-group">
		<label>Group by</label>

		<div class="radio" v-for="entity in event.entities">
			<label>
				<input type="radio" v-model="groupByEntity" :value="entity" :checked="$index == 0">
				{{entity | capitalize}}
			</label>
		</div>
	</div>
</template>

<script type="text/babel">
	const _ = window.require('lodash');
	const color = window.require('./dist/components/color/one-color-all-debug');
	const faCache = require('js/web/font-awesome-cache');
	const THREE = window.require('three');
	const fs = window.require('fs');

	const TELEPORT_DISTANCE_SQ = Math.pow(256, 2);

	export default {
		replace: false,
		props: ['event', 'all', 'available', 'sessions', 'scene'],
		data() {
			return {
				fadeOverTime: true,
				selectedLocation: null,
				groupByEntity: null,
				locations: [],
				points: [],
				sceneObjects: [],
				sessionMaterials: []
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
				for (let i = 0; i < this.points.length; ++i) {
					let [session, entityPoints] = this.points[i];

					let material = new THREE.ShaderMaterial({
						uniforms: {
							useTexture: {type: 'i', value: 0},
							colour: {type: 'c', value: new THREE.Color()},
							minTick: {type: 'f', value: 0},
							maxTick: {type: 'f', value: 1},
							fadeOld: {type: 'i', value: 0},
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
						this.scene.add(line);
						this.sceneObjects.push(line);
					}
				}
			}
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
				let queryString = `SELECT *, (events.entities ->> :entity) AS entity, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id IN (:sessionIds)
          AND events.locations ? :location
          AND events.entities ? :entity
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
		},
		detached() {
			this.clear();
		}
	}
</script>
