<script type="text/babel">
	/**
	 * Component for rendering onto timeline.
	 * Pseudo-visualisation as this is actually handled by {@link VisualisationTab}
	 * @module components/VisTimeline
	 *
	 * @param {GameEvent[]} all - All game events for this session set
	 * @param {GameEvent[]} available - Two way. Game events that can be visualised by this component
	 */

	export default {
		props: {
			all: {
				required: true
			},
			available: {
				required: true,
				twoWay: true
			}
		},
		replace: false,
		ready() {
			this.available = this.all;
		}
	}
</script>
