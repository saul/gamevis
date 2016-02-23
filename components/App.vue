<template>
	<div class="container-fluid">
		<gv-alerts v-ref:alerts></gv-alerts>

		<ul class="nav nav-tabs" role="tablist">
			<li v-for="tab in tabs" @click="switchTab($index)" :class="{'active': tab.selected}">
				<a href="#" role="tab">
					<button type="button" class="close" @click="closeTab($index)" aria-label="Close">
						<span aria-hidden="true">×</span>
					</button>

					{{tab.title}}
				</a>
			</li>

			<li>
				<a href="#" @click="addTab">
					<span class="glyphicon glyphicon-plus"></span>
				</a>
			</li>
		</ul>

		<div class="tab-content">
			<div class="tab-content">
				<gv-visualisation-tab v-ref:vis v-for="tab in tabs" track-by="id" role="tabpanel" class="tab-pane" :class="{'active': tab.selected}" :title.sync="tab.title"></gv-visualisation-tab>
			</div>
		</div>
	</div>
</template>

<script type="text/babel">
	export default {
		el: 'body',
		replace: false,
		data: {
			atomicTabs: 0,
			tabs: [],
		},
		methods: {
			addTab() {
				let i = this.tabs.push({
					id: this.atomicTabs++,
					selected: false,
					title: 'Untitled'
				});

				this.switchTab(i - 1);
			},
			closeTab(index) {
				// find index of the selected tab
				let selectedIndex = this.tabs.findIndex(q => q.selected);

				this.tabs.splice(index, 1);

				let closedSelected = index == selectedIndex;

				// no choice if there's no tabs remaining or only 1 left
				if (this.tabs.length === 0) {
					return this.addTab();
				}
				if (this.tabs.length === 1) {
					return this.switchTab(0);
				}

				// if the tab was selected upon closing, switch to the tab to the left
				if (closedSelected) {
					return this.switchTab(Math.min(index, this.tabs.length - 1));
				}

				if (index > selectedIndex) {
					return this.switchTab(index - 1);
				}
			},
			switchTab(index) {
				this.tabs.forEach((q, i) => {
					q.selected = i == index;
				});
			},
		},
		events: {
			error(err) {
				this.$refs.alerts.$emit('error', err);
			}
		},
		ready() {
			this.addTab();
		}
	}
</script>
