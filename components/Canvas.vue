<template>
	<canvas class="visualisation__canvas"></canvas>
</template>

<script type="text/babel">
	module.exports = {
		props: ['heatmap', 'gradientPath'],
		ready() {
			this.heatmap = window.createWebGLHeatmap({
				canvas: this.$el,
				intensityToAlpha: true,
				gradientTexture: 'img/gradients/plasma.png'
			});

			this.$watch('gradientPath', () => {
				let image = new Image();
				image.onload = () => {
					return this.heatmap.gradientTexture.bind().upload(image);
				};
				image.src = this.gradientPath;
			});
		}
	}
</script>

<style lang="less" type="text/less">
	.visualisation__canvas {
		position: absolute;
		width: 100%;
		height: 100%;
	}
</style>
