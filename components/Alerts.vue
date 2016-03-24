<template>
	<div class="alerts" v-if="alerts.length">
		<div v-for="alert in alerts" class="alert alert-dismissible" :class="['alert-' + alert.className]" role="alert">
			<button type="button" class="close" @click="dismiss($index)" aria-label="Close">
				<span aria-hidden="true">&times;</span>
			</button>

			<h4 class="alert-heading">{{ alert.headline }}</h4>

			<p class="alert__text" v-if="alert.text">{{ alert.text | capitalize }}</p>

			<pre v-if="alert.stack">{{ alert.stack }}</pre>
		</div>
	</div>
</template>

<script type="text/babel">
	/**
	 * Alert component for overlaying notifications.
	 * @module components/Alerts
	 */

	/**
	 * Error event.
	 *
	 * @event error
	 * @global
	 * @type {Error}
	 */

	export default {
		data() {
			return {
				alerts: []
			}
		},
		events: {
			/**
			 * Converts an exception into an error alert.
			 * @instance
			 * @memberof module:components/Alerts
			 * @listens error
			 * @param {Error} error
			 */
			error(error) {
				this.alerts.push({
					className: 'danger',
					headline: error.name,
					text: error.message
				})
			}
		},
		methods: {
			/**
			 * Dismiss an alert.
			 * @instance
			 * @memberof module:components/Alerts
			 * @param {number} index
			 */
			dismiss(index) {
				this.alerts.splice(index, 1);
			},
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

	.alert__text {
		font-family: @font-family-monospace;
		white-space: pre;
	}
</style>
