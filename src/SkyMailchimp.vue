<script src="./SkyMailchimp.js"></script>
<style lang="scss" src="./SkyMailchimp.scss"></style>

<template>
	<div class="sky-mailchimp">
		<div
			class="sky-mailchimp-signup"
			v-if="!states.submitted"
		>
			<p
				class="teaser"
				v-if="merged.text.teaser"
				v-text="merged.text.teaser"
			/>
			<form ref="formElement" novalidate>
				<div
					:ref="`${input.name}Parent`"
					class="form-group"
					v-for="input in merged.form"
					:key="input.name"
					v-if="input.type === 'email' || currentStep === 'submit'"
				>
					<input
						:ref="input.name"
						:type="input.type"
						:name="input.name"
						v-model="mailchimp[input.name]"
						:placeholder="input.placeholder"
						:required="input.required"
						:disabled="((states.unauthorized) && (input.type === 'email')) || ((input.type === 'email') && (currentStep === 'submit') && advanced)"
						v-sky-approve="input.id || input.name"
					/>

					<label
						v-if="input.showLabel"
						:for="input.name"
						v-text="input.label"
					/>
					<span
						class="help-block"
						v-text="input.helpText"
					/>
					<span
						class="text-danger"
						v-text="input.error"
					/>
				</div>

				<div
					class="form-group checkboxes"
					v-if="advanced && currentStep === 'submit'"
					v-for="(group, gIndex) in mailchimp.groups"
					:key="group.id"
				>
					<label
						v-if="group.name"
						v-text="group.name"
					/>

					<div class="checkboxes">
						<div
							class="checkbox"
							v-for="(checkbox, cIndex) in group.items"
							:key="cIndex"
						>
							<input
								type="checkbox"
								:checked="checkbox.checked"
								@click="toggleCheckbox(group.id, cIndex)"
							/>
							<label v-text="checkbox.value" />
						</div>
					</div>

					<span
						class="text-danger"
						v-text="'Vælg min. et nyhedsbrev.'"
					/>
				</div>

				<div
					class="form-group"
					v-if="states.unauthorized"
				>
					<span v-if="!states.requestedUpdateLink">
						{{merged.text.status.hasSubscription}}<br />
						<a
							class="sky-mailchimp-request-link"
							href=""
							@click.prevent="requestUpdateLink"
							v-text="buttonObject.updateLink"
						/>
						<br />
					</span>
					<span
						v-if="states.requestedUpdateLink"
						v-text="merged.text.status.updateLinkSent"
					/>
				</div>

				<div
					class="form-group submit"
					v-if="!states.unauthorized"
				>
					<button
						v-if="currentStep === key"
						v-for="(value, key) in buttonObject"
						:key="key"
						:class="key"
						@click.prevent="buttonHub(key)"
					>
						<span v-text="value" />
					</button>
				</div>
			</form>
		</div>

		<div :class="['sky-mailchimp-loader', {'show': states.loading}]">
			<div class="sky-mailchimp-loader-wrap">
				<span
					class="sky-mailchimp-loader-content"
					v-text="loaderText"
				/>
			</div>
		</div>

		<div
			class="sky-mailchimp-feedback"
			v-if="states.submitted"
		>
			<h2 v-text="feedbackText.header" />
			<p v-text="feedbackText.description" />
		</div>
	</div>
</template>
