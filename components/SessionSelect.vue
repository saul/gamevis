<template>
	<fieldset :disabled="all.length == 0">
		<div class="col-sm-12" v-for="session in selected" track-by="id">
			<div class="form-group form-group-flex">
				<select class="form-control" v-model="session.record" :disabled="all.length == 0" @change="sessionChange(session)">
					<option v-for="record in all" :value="record">
						{{record.title}}
					</option>
				</select>

				<button type="button" class="btn btn-danger" @click="remove($index)">
					<span class="glyphicon glyphicon-minus-sign"></span>
				</button>
			</div>

			<div class="form-group">
				<label class="col-sm-4">Colour</label>
				<div class="col-sm-8">
					<input type="color" v-model="session.colour" class="form-control input-sm">
				</div>
			</div>
		</div>

		<div class="form-group clearfix">
			<div class="col-sm-12">
				<button type="button" class="btn btn-success pull-right" @click="add">
					<i class="fa fa-gamepad"></i>
					Add Session
				</button>
			</div>
		</div>
	</fieldset>
</template>

<script type="text/babel">
	const color = window.require('./dist/components/color/one-color-all-debug');

	const _ = window.require('lodash');
	const models = window.models;
	const db = window.db;

	const GOLDEN_RATIO_CONJUGATE = 0.618033988749895;
	const HUE_SEED = Math.random();

	let sessionUid = 0;

	export default {
		props: ['gameLevel', 'selected', 'events'],
		data() {
			return {
				all: []
			}
		},
		methods: {
			add() {
				let hue = Math.random();

				if (this.selected.length > 0) {
					// add the golden ratio conjugate to the last hue
					hue = color(this.selected[this.selected.length - 1].colour)
						.hue(GOLDEN_RATIO_CONJUGATE, true)
						.hue();
				}

				let c = new color.HSV(hue, 0.5, 0.95);

				let session = {
					id: sessionUid++,
					record: this.all[0],
					minTick: 0,
					maxTick: 0,
					colour: c.hex(),
					tickRange: [0, 0]
				};
				this.selected.push(session);

				// trigger a 'change' so we grab the tick range data
				this.sessionChange(session);
			},
			remove(index) {
				this.selected.splice(index, 1);
			},
			sessionChange(session) {
				this.refreshEvents();

				session.minTick = 0;
				session.maxTick = 0;

				models.Event.find({
						attributes: [
							[db.fn('min', db.col('tick')), 'minTick'],
							[db.fn('max', db.col('tick')), 'maxTick']
						],
						where: {
							session_id: session.record.id,
						}
					})
					.then(result => {
						session.minTick = result.get('minTick');
						session.maxTick = result.get('maxTick');
						session.tickRange = [session.minTick, session.maxTick];
					})
					.catch(err => this.$dispatch('error', err));
			},
			refresh() {
				this.all = [];

				models.Session.findAll({
						where: {
							game: this.gameLevel.game,
							level: this.gameLevel.level
						},
						attributes: ['id', 'level', 'title', 'game'],
						order: [['id', 'DESC']],
					})
					.then(sessions => {
						this.all = sessions.map(x => _.toPlainObject(x.get({plain: true})));
					})
					.catch(err => this.$dispatch('error', err));
			},
			refreshEvents() {
				const sessionIds = [].concat(this.selected)
					.filter(s => s.record)
					.map(s => s.record.id);

				this.events = [];

				if (!sessionIds.length) {
					return;
				}

				console.time('session events');

				db.query(`SELECT DISTINCT ON (name) name, locations, entities
FROM events
WHERE events.session_id IN (:sessionIds)
ORDER BY name`, {
						type: db.QueryTypes.SELECT,
						replacements: {sessionIds: sessionIds}
					})
					.then(results => {
						this.events = results.map(row => {
							return {
								name: row.name,
								locations: _.keys(row.locations),
								entities: _.keys(row.entities)
							}
						});

						console.timeEnd('session events');
					})
					.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.selected = [];

			this.$watch('gameLevel', this.refresh.bind(this));
			this.$watch('all', this.refreshEvents.bind(this));
			this.$watch('selected', this.refreshEvents.bind(this));
		}
	}
</script>
