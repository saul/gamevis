<template>
	<div class="input-group">
		<span class="input-group-addon">
			<i :class="['fa', value]"></i>
		</span>
		<input class="form-control" v-el:input v-model="value">
	</div>
</template>

<script type="text/babel">
	require('dist/components/fontawesome-iconpicker/dist/js/fontawesome-iconpicker');

	export default {
		props: {
			value: {
				twoWay: true
			}
		},
		data() {
			return {
				$icon: null
			}
		},
		ready() {
			this.$icon = $(this.$els.input).iconpicker();

			// form value has changed but event may not have been triggered by the iconpicker plugin
			this.$icon.on('iconpickerUpdated', () => {
				this.value = this.$els.input.value;
			});
		}
	}
</script>
