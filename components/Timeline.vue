<template>
	<div class="timeline" v-el:timeline></div>
</template>

<script type="text/babel">
	const vis = window.require('./dist/components/vis/dist/vis');

	export default {
		props: ['items', 'groups'],
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
						millisecond:'SSS[ms]',
						second:     'HH:mm:ss',
						minute:     'HH:mm',
						hour:       'HH:mm',
					},
					majorLabels: {
						millisecond:'HH:mm:ss',
						second:     'HH:mm',
						minute:     'HH [hours]',
						hour:       '',
						weekday:    '',
						day:        '',
						month:      '',
						year:       ''
					}
				},
				min: 0, // msec
				max: 1000 * 60 * 60 * 2, // msec
				maxHeight: 300
			};

			this.timeline = new vis.Timeline(this.$els.timeline, this.items, options);
			this.timeline.setGroups(this.groups);

			window.timeline = this.timeline;
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	.timeline {
		width: 1024px;
	}
</style>
