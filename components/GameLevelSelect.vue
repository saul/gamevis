<template>
	<select class="form-control" v-model="selected" :disabled="gameLevels.length == 0">
		<option v-for="gameLevel in gameLevels" :value="gameLevel">
			{{gameLevel.game}}/{{gameLevel.level}}
		</option>
	</select>
</template>

<script type="text/babel">
	/**
	 * Contains a list of visualisation components and filter lists.
	 * Keeps track of layer ordering and whether each layer should be rendered or not.
	 * @module components/GameLevelSelect
	 *
	 * @param {GameLevel} selected - Two way
	 */

	/**
	 * @typedef {object} GameLevel
	 * @global
	 * @property {string} game - Short name of game
	 * @property {string} level - Level name
	 */

	const db = window.db;

	export default {
		props: {
			selected: {
				required: true,
				twoWay: true
			},
		},
		data() {
			return {
				gameLevels: [],
			}
		},
		methods: {
			/**
			 * Refreshes `this.gameLevels` with the database.
			 * @instance
			 * @memberof module:components/GameLevelSelect
			 */
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
