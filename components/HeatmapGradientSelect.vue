<template>
	<div class="form-group">
		<label class="col-sm-4">Colour gradient</label>

		<div class="col-sm-8">
			<select class="form-control" v-model="selected" :disabled="all.length == 0">
				<option v-for="gradient in all" value="{{ gradient.path }}">
					{{ gradient.baseName | capitalize }}
				</option>
			</select>
		</div>
	</div>
</template>

<script type="text/babel">
	/**
	 * Component for selecting a heatmap gradient.
	 * @module components/HeatmapGradientSelect
	 *
	 * @param {string} selected - Two way. Path to gradient image.
	 */

	const assert = window.require('assert');
	const fs = window.require('fs');
	const path = window.require('path');

	/**
	 * Path to the gradient textures directory
	 */
	const GRADIENT_BASE = 'img/gradients';

	export default {
		props: {
			selected: {
				required: true,
				twoWay: true,
			}
		},
		data() {
			return {
				all: []
			}
		},
		ready() {
			fs.readdir(GRADIENT_BASE, (err, files) => {
				assert.ifError(err);

				this.all = files.filter(name => !name.startsWith('.'))
					.map(file => {
						return {
							path: path.join(GRADIENT_BASE, file),
							baseName: path.parse(file).name
						}
					});
			});
		}
	}
</script>
