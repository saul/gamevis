<template>
	<fieldset :disabled="!enabled">
		<div class="form-group">
			<label for="sessionId">Session</label>

			<div class="input-group">
				<select class="form-control" id="sessionId" v-model="selectedSession" :disabled="sessions.length == 0">
					<option v-for="session in sessions" :value="session" :selected="$index == 0">
						{{session.title}} [{{session.level}} on {{session.game}}]
					</option>
				</select>

					<span class="input-group-btn">
						<button class="btn btn-default" type="button" @click="refreshSessions">
							<span class="glyphicon glyphicon-refresh"></span>
						</button>
					</span>
			</div>
		</div>

		<div class="form-group">
			<label>Colour gradient</label>

			<select class="form-control" v-model="gradientPath" :disabled="gradientTextures.length == 0">
				<option v-for="gradient in gradientTextures" value="{{ gradient.path }}">
					{{ gradient.baseName | capitalize }}
				</option>
			</select>
		</div>

		<fieldset :disabled="selectedSession == null">
			<div class="form-group">
				<label for="eventName">Event</label>

				<select class="form-control" id="eventName" v-model="selectedEvent" :disabled="events.length == 0">
					<option v-for="event in events" :value="event">{{event.name}}</option>
				</select>
			</div>

			<div class="form-group" v-if="selectedEvent">
				<label>Plot</label>

				<div class="radio" v-for="location in selectedEvent.locations">
					<label>
						<input type="radio" v-model="selectedLocation" :value="location" :checked="$index == 0">
						{{location | capitalize}}
					</label>
				</div>
			</div>
		</fieldset>

		<fieldset :disabled="selectedEvent == null">
			<label>{{filters.length | pluralize 'Filter'}} ({{filters.length}})</label>

			<div class="session-form__filter form-group" v-for="filter in filters" track-by="id">
				<select class="form-control" v-model="filter.target">
					<option value="_event">Event</option>
					<option v-for="entity in selectedEvent.entities" :value="entity" :selected="$index == 0">
						{{entity | capitalize}}
					</option>
				</select>

				<input type="text" class="form-control" v-model="filter.prop">

				<select class="form-control" v-model="filter.comparator">
					<option v-for="comparator in comparators" :value="comparator" :selected="$index == 0">
						{{{ comparator.text }}}
					</option>
				</select>

				<input type="text" class="form-control" v-model="filter.value">

				<button type="button" class="btn btn-danger" @click="removeFilter($index)">
					<span class="glyphicon glyphicon-minus-sign"></span>
				</button>
			</div>

			<div class="form-group clearfix">
				<button type="button" class="btn btn-default pull-right" @click="addFilter">
					<span class="glyphicon glyphicon-filter"></span>
				</button>
			</div>
		</fieldset>
	</fieldset>
</template>

<script type="text/babel">
	const _ = window.require('lodash');
	const db = window.db;
	const models = window.models;

	module.exports = {
		props: ['heatmap', 'enabled', 'gradientPath', 'gradientTextures', 'readyToVisualise'],
		replace: false,
		data() {
			return {
				selectedSession: null,
				selectedEvent: null,
				selectedLocation: null,
				sessions: [],
				filters: [],
				events: [],
				points: [],
				comparators: [
					{
						text: '=',
						sql: '=',
						cast: 'text'
					},
					{
						text: '&ne;',
						sql: '!=',
						cast: 'text'
					},
					{
						text: '&lt;',
						sql: '<',
						cast: 'int'
					},
					{
						text: '&le;',
						sql: '<=',
						cast: 'int'
					},
					{
						text: '&gt;',
						sql: '>',
						cast: 'int'
					},
					{
						text: '&ge;',
						sql: '>=',
						cast: 'int'
					}
				]
			};
		},
		computed: {
			readyToVisualise() {
				return this.selectedSession && this.selectedEvent && this.selectedLocation && this.gradientPath;
			}
		},
		ready() {
			this.$watch('selectedSession', () => {
				this.points = [];
				this.events = [];

				db.query(`SELECT DISTINCT ON (name) name, locations, entities
FROM events
WHERE events.session_id = :sessionId
AND events.locations IS NOT NULL
ORDER BY name`, {
							type: db.QueryTypes.SELECT,
							replacements: {sessionId: this.selectedSession.id}
						})
						.then(results => {
							this.events = results.map(row => {
								return {
									name: row.name,
									locations: _.keys(row.locations),
									entities: _.keys(row.entities)
								}
							});

							console.log('Got events:', this.events);
						})
						.catch(err => this.$dispatch('error', err));

				this.$dispatch('updateBackdrop', this.selectedSession);
			});

			this.$watch('points', () => {
				if (this.heatmap == null) {
					console.warn('no heatmap to update');
					return;
				}
				this.heatmap.clear();
				this.heatmap.addPoints(this.points);
			});

			this.refreshSessions();
		},
		methods: {
			refreshSessions() {
				models.Session.findAll({
							attributes: ['id', 'level', 'title', 'game'],
							order: [['id', 'DESC']]
						})
						.then(sessions => {
							this.sessions = sessions.map(x => _.toPlainObject(x.get({plain: true})));
							console.log('Got sessions:', this.sessions);
						})
						.catch(err => this.$dispatch('error', err));
			},
			addFilter() {
				this.filters.push({
					id: Math.random(),
					target: null,
					prop: '',
					comparator: null,
					value: ''
				});
			},
			removeFilter(index) {
				this.filters.splice(index, 1);
			},
			getResults(intensity) {
				let queryString = `SELECT *, (events.locations ->> :location) AS position
          FROM events
          WHERE events.name = :event
          AND events.session_id = :sessionId
          AND events.locations ? :location`;

				this.filters.forEach(filter => {
					if (filter.target === '_event') {
						queryString += `\nAND (events.data->>${db.escape(filter.prop)})::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
					} else {
						queryString += `\nAND ((
              SELECT entity_props.value
              FROM entity_props
              WHERE entity_props.index = (events.entities->>${db.escape(filter.target)})::int
              AND entity_props.tick <= events.tick
              AND entity_props.prop = ${db.escape(filter.prop)}
              AND entity_props.session_id = events.session_id
              ORDER BY entity_props.tick DESC
              LIMIT 1
            )->>'value')::${filter.comparator.cast} ${filter.comparator.sql} ${db.escape(filter.value)}`;
					}
				});

				console.log(' *** Query');

				this.points = [];
				console.time('query');

				return db.query(queryString, {
							type: db.QueryTypes.SELECT,
							replacements: {
								event: this.selectedEvent.name,
								sessionId: this.selectedSession.id,
								location: this.selectedLocation
							}
						})
						.then(results => {
							console.timeEnd('query');

							console.log('Query returned %d rows', results.length);

							let overviewData = require(`./overviews/${this.selectedSession.game}/${this.selectedSession.level}.json`);

							console.time('render');

							this.points = results.map(row => {
								let position = JSON.parse(row.position);
								let x = (position.x - overviewData.pos_x) / overviewData.scale;
								let y = (overviewData.pos_y - position.y) / overviewData.scale;

								return {x, y, scale: overviewData.scale, intensity};
							});

							console.timeEnd('render');
						})
						.catch(err => this.$dispatch('error', err));
			},
		}
	}
</script>
