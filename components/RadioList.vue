<template>
	<div class="form-group">
		<label class="col-sm-4">{{label}}</label>

		<div class="col-sm-8">
			<div class="radio" v-for="element in all">
				<label>
					<input type="radio" v-model="selected" :value="element" :checked="$index == 0">
					{{element | capitalize}}
				</label>
			</div>
		</div>
	</div>
</template>

<script type="text/babel">
	/**
	 * Component for displaying an array as a radio list.
	 * @module components/RadioList
	 *
	 * @param {string} label - Radio list label.
	 * @param {T[]} all - Radio list options.
	 * @param {T} selected - Two way. Selected value.
	 */

	export default {
		props: {
			label: {
				type: String,
				required: true
			},
			all: {
				type: Array,
				required: true
			},
			selected: {
				twoWay: true,
				required: true
			}
		}
	}
</script>
