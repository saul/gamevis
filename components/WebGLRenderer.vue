<template>
	<div v-el:container class="webgl-container">
		<canvas v-el:canvas></canvas>
	</div>
</template>

<script type="text/babel">
	/**
	 * Component for setting up Three.js and running the render loop.
	 * @module components/WebGLRenderer
	 *
	 * @param {ThreeCamera} camera - Two way. Three.js camera object
	 * @param {ThreeScene} scene - Two way. Three.js scene
	 */

	/**
	 * Called per-frame at each iteration of the render loop.
	 * @event render
	 * @global
	 */

	/**
	 * Called at the end of each iteration of the render loop.
	 * @event postrender
	 * @global
	 */

	const THREE = window.require('three');
	const Stats = window.require('stats.js');

	export default {
		props: {
			camera: {
				twoWay: true
			},
			scene: {
				twoWay: true
			}
		},
		data() {
			return {
				canvas: null,
				renderer: null,
				stats: null
			}
		},
		methods: {
			/**
			 * Render a single frame.
			 * @instance
			 * @memberof module:components/WebGLRenderer
			 * @fires render
			 * @fires postrender
			 */
			render() {
				window.requestAnimationFrame(this.render.bind(this));

				this.stats.begin();
				this.$emit('render');
				this.renderer.render(this.scene, this.camera);
				this.$emit('postrender');
				this.stats.end();
			},

			/**
			 * Save the canvas to an image.
			 * @instance
			 * @memberof module:components/WebGLRenderer
			 * @param {string} type - Image type
			 * @returns {string} data URL
			 */
			toDataURL(type) {
				return this.canvas.toDataURL(type);
			}
		},
		ready() {
			this.canvas = this.$els.canvas;

			// Transform coordinate system to use the Z axis as 'up'
			THREE.Object3D.DefaultUp.set(0, 0, 1);

			this.renderer = new THREE.WebGLRenderer({antialias: true, canvas: this.canvas});
			this.renderer.setSize(1024, 1024);
			this.renderer.setPixelRatio(window.devicePixelRatio);

			let camera = new THREE.OrthographicCamera(0, 1, 0, 1, -20000, 20000);
			this.camera = camera;

			let scene = new THREE.Scene();
			this.scene = scene;

			this.stats = new Stats();
			this.stats.setMode(0); // 0: fps, 1: ms, 2: mb

			// align top-left
			this.stats.domElement.style.position = 'absolute';
			this.stats.domElement.style.left = '0px';
			this.stats.domElement.style.top = '0px';

			this.$els.container.appendChild(this.stats.domElement);

			window.requestAnimationFrame(this.render.bind(this));
		}
	}
</script>

<style lang="less" rel="stylesheet/less">
	.webgl-container {
		position: relative;
	}
</style>
