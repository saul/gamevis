<template>
	<div class="row app-row__main">
		<div class="col-xs-4 main-panel__sidebar">
			<form>
				<div class="form-group">
					<label>Game/Level</label>
					<gv-game-level-select :selected.sync="gameLevel"></gv-game-level-select>
				</div>

				<div class="form-group">
					<label>Sessions</label>
					<gv-session-select :selected.sync="sessions" :game-level="gameLevel" :events.sync="allEvents"></gv-session-select>
				</div>

				<label>Events</label>
				<gv-timeline-events :all="allEvents" :selected.sync="events" :sessions="sessions"></gv-timeline-events>

				<button type="submit" class="btn btn-success btn-lg btn-block" @click.prevent="visualise" :disabled="!readyToVisualise">
					<span class="glyphicon glyphicon-eye-open"></span>
					Visualise
				</button>
			</form>
		</div>

		<div class="col-xs-8">
			<gv-timeline :items="timeline.items" :groups="timeline.groups"></gv-timeline>
			<gv-timeline-canvas v-ref:canvas></gv-timeline-canvas>
		</div>
	</div>
</template>

<script type="text/babel">
	const db = window.db;

	export default {
		data() {
			return {
				gameLevel: null,
				sessions: [],
				allEvents: [],
				events: [],
				overviewImage: null,
				overviewData: null,
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
				if (this.overviewImage && this.overviewImage.complete) {
					e.context.fillStyle = 'black';
					e.context.fillRect(0, 0, e.canvas.offsetWidth, e.canvas.offsetHeight);

					e.context.drawImage(this.overviewImage, 0, 0);

					this.$broadcast(
						'drawEventPoints',
						Object.assign({}, e, {
							overviewData: this.overviewData
						})
					);
				}
			},
			loadOverview() {
				this.overviewData = window.require(`./overviews/${this.gameLevel.game}/${this.gameLevel.level}.json`);

				this.overviewImage = new Image();
				this.overviewImage.src = `overviews/${this.gameLevel.game}/${this.gameLevel.level}.png`;
			},
			visualiseTimeline() {
				this.timeline.items = [];
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
						this.timeline.items = results.map(row => {
							return {
								id: row.id,
								content: row.name,
								group: row.session_id,
								start: row.tick * (1000 / 128) // TODO: this should be multiplying by the tickrate!!
							}
						});
					})
					.catch(err => this.$dispatch('error', err));
			},
			visualise() {
				this.visualiseTimeline();
				this.$broadcast('visualise');
			}
		},
		ready() {
			this.$watch('gameLevel', this.loadOverview.bind(this));
			this.$refs.canvas.$on('render', this.render.bind(this));
		}
	}
</script>
