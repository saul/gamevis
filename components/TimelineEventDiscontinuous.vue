<template>
	<div v-if="event" class="form-group">
		<div class="radio" v-for="location in event.locations">
			<label>
				<input type="radio" v-model="selectedLocation" :value="location" :checked="$index == 0">
				{{location | capitalize}}
			</label>
		</div>
	</div>

	<div class="form-group form-group-flex">
		<label>Icon</label>
		<iconpicker :value.sync="iconClass" class="input-sm"></iconpicker>
	</div>
</template>

<script type="text/babel">
	const faCache = require('js/web/font-awesome-cache');

	export default {
		replace: false,
		props: ['event', 'all', 'available', 'sessions'],
		data() {
			return {
				iconClass: 'fa-crosshairs',
				selectedLocation: null,
				locations: [],
				points: []
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
			}
		},
		events: {
			drawEventPoints(e) {
				e.context.save();
				e.context.resetTransform();

				var scale = e.pixelRatio / e.overviewData.scale;
				e.context.scale(scale, scale);

				e.context.translate(-e.overviewData.pos_x, e.overviewData.pos_y);

				// 'pixels' here is actually game units
				e.context.font = `128px FontAwesome`

				this.points.forEach(point => {
					let [min, max] = point.session.tickRange;

					if (point.tick >= min && point.tick <= max) {
						e.context.fillStyle = point.session.colour;
						e.context.fillText(this.iconText, point.position.x, -point.position.y);
					}
				});

				e.context.restore();
			},
			visualise() {
				let queryString = `SELECT *, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id IN (:sessionIds)
          AND events.locations ? :location`;

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

						this.points = results.map(row => {
							return {
								tick: row.tick,
								position: JSON.parse(row.position),
								session: this.sessions.find(s => s.record.id == row.session_id)
							}
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
