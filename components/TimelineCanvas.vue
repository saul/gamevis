<template>
	<canvas class="visualisation" v-el:canvas></canvas>
</template>

<script type="text/babel">
	const PIXEL_RATIO = (function () {
		var ctx = document.createElement('canvas').getContext('2d'),
			dpr = window.devicePixelRatio || 1,
			bsr = ctx.webkitBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;

		return dpr / bsr;
	})();

	export default {
		data() {
			return {
				canvas: null,
				context: null
			}
		},
		methods: {
			render() {
				window.requestAnimationFrame(this.render.bind(this));

				this.context.resetTransform();
				this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
				this.context.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, 0, 0);

				this.$emit('render', {canvas: this.canvas, context: this.context, pixelRatio: PIXEL_RATIO});
			}
		},
		ready() {
			this.canvas = this.$els.canvas;
			this.context = this.canvas.getContext('2d');

			this.canvas.width = this.canvas.offsetWidth * PIXEL_RATIO;
			this.canvas.height = this.canvas.offsetHeight * PIXEL_RATIO;

			this.render();
		}
	}
</script>
