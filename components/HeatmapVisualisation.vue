<template>
	<div class="row app-row__main">
		<div class="col-xs-4 main-panel__filters">
			<ul class="nav nav-pills" role="tablist">
				<li role="presentation" v-for="query in queries" @click="switchQueryTab($index)" :class="{'active': query.selected}">
					<a href="#" role="tab">
						<button type="button" class="close" @click.stop="closeQuery($index)" aria-label="Close">
							<span aria-hidden="true">×</span>
						</button>

						#{{ $index + 1 }}
					</a>
				</li>

				<li role="presentation">
					<a href="#" @click="addQuery">
						<span class="glyphicon glyphicon-plus"></span>
					</a>
				</li>
			</ul>

			<form @submit.prevent="visualise">
				<div class="tab-content">
					<div v-for="query in queries" role="tabpanel" class="tab-pane" :class="{'active': query.selected}" is="gv-query-form" :enabled="!querying" :heatmap.sync="query.heatmap" :gradient-path.sync="query.gradientPath" :gradient-textures="gradientTextures" :ready-to-visualise.sync="query.readyToVisualise" v-ref:query track-by="id">
					</div>
				</div>

				<hr/>

				<div class="form-group">
					<label for="intensity">Point intensity</label>
					<input type="text" class="form-control" id="intensity" v-model="intensity">
				</div>

				<button type="submit" class="btn btn-success btn-lg btn-block">
					<template v-if="querying">
						<span class="loading-icon"></span>
					</template>
					<template v-else>
						<span class="glyphicon glyphicon-eye-open"></span>
						Visualise
					</template>
				</button>
			</form>
		</div>

		<div class="col-xs-8">
			<div class="visualisation" v-el:canvas-backdrop>
				<gv-canvas v-for="query in queries" :heatmap.sync="query.heatmap" track-by=id :gradient-path="query.gradientPath"></gv-canvas>
			</div>
		</div>
	</div>
</template>

<script type="text/babel">
	const path = window.require('path');
	const fs = window.require('fs');
	const Promise = window.require('bluebird');
	const assert = window.require('assert');

	// path to the gradient textures directory
	const GRADIENT_BASE = 'img/gradients';

	module.exports = {
		data() {
			return {
				queries: [],
				intensity: 0.5,
				querying: false,
				gradientTextures: []
			}
		},
		computed: {
			readyToVisualise() {
				return this.queries.reduce((memo, q) => memo && q.readyToVisualise, true);
			}
		},
		methods: {
			visualise() {
				if (!this.readyToVisualise) {
					return this.alerts.push({
						className: 'warning',
						headline: 'All inputs must be complete to visualise'
					});
				}

				this.querying = true;

				Promise.map(
						this.$refs.query,
						q => q.getResults(this.intensity)
				).finally(() => {
					this.querying = false;
				});
			},
			addQuery() {
				let i = this.queries.push({
					id: Math.random(),
					selected: false,
					heatmap: null,
					gradientPath: null,
					readyToVisualise: false
				});

				this.switchQueryTab(i - 1);
			},
			closeQuery(index) {
				console.log('closeQuery', index);

				// find index of the selected tab
				let selectedIndex = this.queries.findIndex(q => q.selected);

				this.queries.splice(index, 1);

				let closedSelected = index == selectedIndex;

				// no choice if there's no tabs remaining or only 1 left
				if (this.queries.length === 0) {
					return this.addQuery();
				}
				if (this.queries.length === 1) {
					return this.switchQueryTab(0);
				}

				// if the tab was selected upon closing, switch to the tab to the left
				if (closedSelected) {
					return this.switchQueryTab(Math.min(index, this.queries.length - 1));
				}

				if (index > selectedIndex) {
					return this.switchQueryTab(index - 1);
				}
			},
			switchQueryTab(index) {
				console.log('switchQueryTab', index);
				this.queries.forEach((q, i) => {
					q.selected = i == index
				});
			},
			tick() {
				window.requestAnimationFrame(this.tick.bind(this));

				this.queries.filter(q => q.heatmap)
						.forEach(q => {
							q.heatmap.update();
							q.heatmap.display();
						});
			},
			updateGradients(err, files) {
				assert.ifError(err);
				this.gradientTextures = files.filter(name => !name.startsWith('.'))
						.map(file => {
							return {
								path: path.join(GRADIENT_BASE, file),
								baseName: path.parse(file).name
							}
						});
			}
		},
		events: {
			updateBackdrop(session) {
				$(this.$els.canvasBackdrop)
						.css('background-image', `url(overviews/${session.game}/${session.level}.png)`)
						.css('background-color', 'black');
			},
			render() {
				this.queries.filter(q => q.heatmap)
						.forEach(q => {
							q.heatmap.update();
							q.heatmap.display();
						});

				// allow children to listen to this event
				return true;
			}
		},
		ready() {
			this.addQuery();
			fs.readdir(GRADIENT_BASE, this.updateGradients.bind(this));
		}
	}
</script>
