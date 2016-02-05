<template>
	<select class="form-control" v-model="selected" :multiple="multiple" :disabled="sessions.length == 0">
		<option v-for="session in sessions" :value="session">
			{{session.title}}
		</option>
	</select>
</template>

<script type="text/babel">
	const _ = window.require('lodash');

	module.exports = {
		props: ['gameLevel', 'selected', 'multiple'],
		data() {
			return {
				sessions: []
			}
		},
		methods: {
			refresh() {
				this.sessions = [];

				models.Session.findAll({
						where: {
							game: this.gameLevel.game,
							level: this.gameLevel.level
						},
						attributes: ['id', 'level', 'title', 'game'],
						order: [['id', 'DESC']],
					})
					.then(sessions => {
						this.sessions = sessions.map(x => _.toPlainObject(x.get({plain: true})));
					})
					.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.$watch('gameLevel', () => this.refresh());
		}
	}
</script>
