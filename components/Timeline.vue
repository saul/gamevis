<template>
	<div class="timeline" v-el:timeline></div>
</template>

<script type="text/babel">
	/**
	 * Component for displaying a Vis.js timeline.
	 * See vis.js documentation for info on items and groups.
	 * @module components/Timeline
	 *
	 * @param {object[]} items
	 * @param {object[]} groups
	 */

	const vis = window.require('./dist/components/vis/dist/vis');

	export default {
		props: {
			items: {
				required: true
			},
			groups: {}
		},
		data() {
			return {
				timeline: null
			}
		},
		ready() {
			this.$watch('items', () => this.timeline.setItems(this.items));
			this.$watch('groups', () => this.timeline.setGroups(this.groups));

			var options = {
				format: {
					minorLabels: {
						millisecond: 'SSS[ms]',
						second: 'HH:mm:ss',
						minute: 'HH:mm',
						hour: 'HH:mm',
					},
					majorLabels: {
						millisecond: 'HH:mm:ss',
						second: 'HH:mm',
						minute: 'HH [hours]',
						hour: '',
						weekday: '',
						day: '',
						month: '',
						year: ''
					}
				},
				min: 0, // msec
				max: 1000 * 60 * 60 * 2, // msec
				maxHeight: 300,
				stack: false,
				editable: {
					add: false,
					updateTime: true,
					updateGroup: false,
					remove: false
				},
				onMoving: this.$emit.bind(this, 'moving'),
				snap: null
			};

			this.timeline = new vis.Timeline(this.$els.timeline, this.items, options);
			this.timeline.setGroups(this.groups);
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	.timeline {
		width: 1024px;
	}
</style>
