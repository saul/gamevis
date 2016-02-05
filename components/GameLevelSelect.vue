<template>
	<select class="form-control" v-model="selected" :disabled="gameLevels.length == 0">
		<option v-for="gameLevel in gameLevels" :value="gameLevel">
			{{gameLevel.game}}/{{gameLevel.level}}
		</option>
	</select>
</template>

<script type="text/babel">
	const db = window.db;

	module.exports = {
		props: ['selected'],
		data() {
			return {
				gameLevels: [],
			}
		},
		methods: {
			refresh() {
				this.gameLevels = [];

				db.query(`SELECT DISTINCT game, level
FROM sessions
ORDER BY game, level`, {
							type: db.QueryTypes.SELECT
						})
						.then(results => {
							this.gameLevels = results.map(row => {
								return {
									game: row.game,
									level: row.level
								}
							});
						})
						.catch(err => this.$dispatch('error', err));
			}
		},
		ready() {
			this.refresh();
		}
	}
</script>
