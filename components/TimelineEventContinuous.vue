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

	const TELEPORT_DISTANCE_SQ = Math.pow(256, 2);

	export default {
		replace: false,
		props: ['event', 'all', 'available', 'sessions'],
		data() {
			return {
				fadeOverTime: true,
				selectedLocation: null,
				groupByEntity: null,
				locations: [],
				points: []
			}
		},
		methods: {
			updateAvailable() {
				if (this.all) {
					this.available = this.all.filter(e => e.locations.length > 0);
				} else {
					this.available = [];
				}
			}
		},
		events: {
			drawEventPoints(e) {
				let ctx = e.context;

				ctx.save();
				ctx.resetTransform();

				let scale = e.pixelRatio / e.overviewData.scale;
				ctx.scale(scale, scale);

				ctx.translate(-e.overviewData.pos_x, e.overviewData.pos_y);

				ctx.lineWidth = 16;

				for (let i = 0; i < this.points.length; ++i) {
					let [session, entityPoints] = this.points[i];

					let sessionColour = color(session.colour);
					let [min, max] = session.tickRange;
					let tickRangeLength = max - min;

					if (!this.fadeOverTime) {
						ctx.strokeStyle = sessionColour.hex();
					}

					for (let j = 0; j < entityPoints.length; ++j) {
						let [entity, points] = entityPoints[j];

						ctx.beginPath();

						let lastPoint = null;

						for (let k = 0; k < points.length; ++k) {
							let event = points[k];

							if (event.tick < min) {
								continue;
							}

							if (event.tick > max) {
								break;
							}

							let pos = event.position;

							// if there was no previous point, or the point has moved such a significant distance, do not connect with
							// the previous point
							if (lastPoint == null || (Math.pow(lastPoint.x - pos.x, 2) + Math.pow(lastPoint.y - pos.y, 2) > TELEPORT_DISTANCE_SQ)) {
								ctx.moveTo(pos.x, -pos.y);
							} else {
								if (this.fadeOverTime) {
									let alpha = (event.tick - min) / tickRangeLength;

									ctx.strokeStyle = sessionColour.alpha(alpha).cssa();
									ctx.lineTo(pos.x, -pos.y);
									ctx.stroke();

									// TODO: is this necessary???
									ctx.beginPath();
									ctx.moveTo(pos.x, -pos.y);
								} else {
									ctx.lineTo(pos.x, -pos.y);
								}
							}

							lastPoint = pos;
						}

						e.context.stroke();
					}
				}

				e.context.restore();
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
					})
					.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.$watch('all', this.updateAvailable.bind(this));
			this.$watch('points', this.$dispatch.bind(this, 'redraw'));
			this.updateAvailable();
		}
	}
</script>
