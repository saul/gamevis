<template>
	<title v-if="selectedTab">Gamevis - {{ selectedTab.title }}</title>

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
	/**
	 * Root application component, contains all components.
	 * @module components/App
	 */

	const ipc = window.require('electron').ipcRenderer;

	export default {
		el: 'body',
		replace: false,
		data: {
			atomicTabs: 0,
			tabs: [],
		},
		computed: {
			selectedTab() {
				return this.tabs.find(q => q.selected);
			}
		},
		methods: {
			/**
			 * Adds a tab to the window.
			 * @instance
			 * @memberof module:components/App
			 */
			addTab() {
				let i = this.tabs.push({
					id: this.atomicTabs++,
					selected: false,
					title: 'Untitled'
				});

				this.switchTab(i - 1);
			},

			/**
			 * Closes an open tab, switching to the left tab if possible.
			 * @instance
			 * @memberof module:components/App
			 * @param {number} index
			 */
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
			/**
			 * Switch active tab.
			 * @instance
			 * @memberof module:components/App
			 * @param index
			 */
			switchTab(index) {
				if (index < 0 || index >= this.tabs.length) {
					console.warn('cannot switch to non-existent tab');
					return;
				}

				this.tabs.forEach((q, i) => {
					q.selected = i == index;
				});
			},
			/**
			 * Command received over IPC from the renderer process.
			 * @instance
			 * @memberof module:components/App
			 * @param {string} cmd
			 */
			command(_, cmd) {
				let selectedIndex = this.tabs.findIndex(q => q.selected);

				switch (cmd) {
					case 'new-tab':
						this.addTab();
						break;
					case 'close-tab':
						if (this.tabs.length === 1) {
							window.close();
						} else {
							this.closeTab(selectedIndex);
						}
						break;
					case 'next-tab':
						this.switchTab(selectedIndex + 1);
						break;
					case 'previous-tab':
						this.switchTab(selectedIndex - 1);
						break;
				}
			},
			/**
			 * Handle key press (switching tabs)
			 * @instance
			 * @memberof module:components/App
			 * @param {KeyEvent} e
			 */
			keyDown(e) {
				let cmdOrCtrl = e.metaKey || e.ctrlKey;
				let numKey = e.which - 48;

				if (cmdOrCtrl && numKey > 0 && numKey < 9) {
					this.switchTab(numKey - 1);
				} else if (cmdOrCtrl && numKey == 9) {
					this.switchTab(this.tabs.length - 1);
				}
			}
		},
		events: {
			/**
			 * Re-emits any error events received to {@link components/Alerts}
			 * @instance
			 * @memberof module:components/App
			 * @listens error
			 */
			error(err) {
				this.$refs.alerts.$emit('error', err);
			}
		},
		ready() {
			this.addTab();

			document.onkeydown = this.keyDown.bind(this);
			ipc.on('command', this.command.bind(this));
		}
	}
</script>
