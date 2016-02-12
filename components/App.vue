<template>
	<div class="container-fluid">
		<div class="alerts" v-if="alerts.length">
			<div v-for="alert in alerts" class="alert alert-dismissible" :class="['alert-' + alert.className]" role="alert">
				<button type="button" class="close" @click="dismissAlert($index)" aria-label="Close">
					<span aria-hidden="true">&times;</span>
				</button>

				<h4 class="alert-heading">{{ alert.headline }}</h4>
				<p v-if="alert.text">{{ alert.text | capitalize }}</p>

				<pre v-if="alert.stack">{{ alert.stack }}</pre>
			</div>
		</div>

		<ul class="nav nav-tabs" role="tablist">
			<li><a href="#heatmap" data-toggle="tab">Heatmap</a></li>
			<li class="active"><a href="#timeline" data-toggle="tab">Timeline</a></li>
		</ul>

		<div class="tab-content">
			<div role="tabpanel" class="tab-pane" id="heatmap">
				<gv-heatmap-visualisation></gv-heatmap-visualisation>
			</div>

			<div role="tabpanel" class="tab-pane active" id="timeline">
				<gv-timeline-visualisation></gv-timeline-visualisation>
			</div>
		</div>
	</div>
</template>

<script type="text/babel">
	export default {
		el: 'body',
		replace: false,
		data: {
			alerts: [],
		},
		methods: {
			onError(error) {
				this.alerts.push({
					className: 'danger',
					headline: error.name,
					text: error.message
				})
			},
			dismissAlert(index) {
				this.alerts.splice(index, 1);
			}
		},
		events: {
			error(err) {
				this.onError(err);
			}
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	@import "../less/variables.less";

	.alerts {
		position: fixed;
		bottom: 0;
		left: 1em;
		right: 1em;
		z-index: @zindex-navbar-fixed;
	}
</style>
