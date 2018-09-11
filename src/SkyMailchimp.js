import axios from 'axios';
import _merge from 'lodash.merge';
import SkyMailchimpState from './SkyMailchimp.state';
import SkyApprove from './sky-approve';

/**
 * TODO: Implementer sky-form når denne er færdig
 */

const defaultTexts = {
	teaser: '',
	submitted: {
		header: 'Dine oplysninger er sendt.',
		created: 'Du modtager en mail, hvor du skal bekræfte din tilmelding.',
		updated: 'Din profil er blevet opdateret.',
	},
	error: {
		header: 'Der skete en fejl.',
		description: 'Prøv igen senere.',
	},
	status: {
		hasSubscription: 'Din e-mail er allerede tilknyttet et eksisterende abonnement.',
		updateLinkSent: 'Af sikkerhedshensyn har vi sendt dig en e-mail med et link, som du skal aktivere for at ændre dine tilmeldinger.',
	},
	button: {
		checkMail: 'Tjek email',
		updateLink: 'Fjern eller tilføj nye emner til dit abonnement',
		submit: 'Tilmeld',
	},
	loadingText: {
		fetchTemplate: 'Vent, mens vi gør klar til din tilmelding…',
		checkMail: 'Vi undersøger, om du allerede abonnerer på et af vores nyhedsbreve…',
		submit: 'Indsender indtastet information…',
		requestUpdateLink: 'Vi er i fuld gang med at skrive en mail til dig…',
		default: 'Behandler data…',
	},
};

const defaultForm = {
	email: {
		id: Math.random().toString(35).substr(2, 5),
		type: 'email',
		name: 'email',
		placeholder: '',
		required: true,
		pattern: null,
		disabled: false,
		checked: false,
		readonly: false,
		value: '',
		label: '',
		helpText: '',
		error: '',
		showLabel: true,
	},
	name: {
		id: Math.random().toString(35).substr(2, 5),
		type: 'text',
		name: 'name',
		placeholder: '',
		required: true,
		pattern: null,
		disabled: false,
		checked: false,
		readonly: false,
		value: '',
		label: '',
		helpText: '',
		error: '',
		showLabel: true,
	},
};

export default {
	name: 'SkyMailchimp',
	directives: { SkyApprove },
	props: {
		contextid: [String, Number],
		listid: [String, Number],
		action: String,
		advanced: {
			type: Boolean,
			default: false,
		},
		text: Object,
		form: Object,
	},
	data() {
		return {
			merged: {
				text: _merge({}, defaultTexts, this.text),
				form: _merge({}, defaultForm, this.form),
			},
			mailchimp: {
				contextId: this.contextid,
				listId: this.listid,
			},
			apiEndpoints: {
				action: this.action || '/umbraco/api/MailChimpSubscriberApi/PostSubscriber',
				getTemplate: '/umbraco/api/skymailchimp/GetTemplate/',
				getSubscriber: '/umbraco/api/skymailchimp/GetSubscriber/',
				sendUpdateLink: '/umbraco/api/skymailchimp/SendUpdateLink/',
			},
			currentStep: null,
			states: {
				requestedUpdateLink: false,
				unauthorized: false,
				mailChecked: false,
				requestType: null,
				submitted: false,
				loading: false,
				success: false,
				error: false,
			},
		};
	},
	computed: {
		loaderText() {
			return this.states.requestType
				? this.merged.text.loadingText[this.states.requestType]
				: this.merged.text.loadingText.default;
		},
		feedbackText() {
			if (this.states.success) {
				return {
					header: this.merged.text.submitted.header,
					description: this.mailchimp.existingUser
						? this.merged.text.submitted.updated
						: this.merged.text.submitted.created,
				};
			}

			return {
				header: this.merged.text.error.header,
				description: this.merged.text.error.description,
			};
		},
		buttonObject() {
			return this.advanced
				? this.merged.text.button
				: { submit: this.merged.text.button.submit };
		},
	},
	beforeMount() {
		if (this.advanced) {
			// Necessary for utilizing v-model on v-if input
			// Does not work in mounted hook
			Object.keys(this.merged.form).forEach((key) => {
				this.$set(this.mailchimp, this.merged.form[key].name, null);
			});
		}
	},
	mounted() {
		if (this.advanced) {
			const searchString = window.location.search;

			// console.log(decodeURI(searchString), 'ASDSD', decodeURIComponent(searchString));
			if (searchString) {
				this.implementQueryInfomation(decodeURIComponent(searchString));

				// If there is a searchString checkmail on next tick
				// giving v-sky-approve time for checking the new data from URL search query
				this.$nextTick(() => {
					this.checkMail();
				});
			} else {
				this.fetchTemplate();
			}
		} else {
			this.currentStep = 'submit';
		}
	},
	methods: {
		buttonHub(callback) {
			// if advanced is not selected ALWAYS submit
			this.advanced
				? this[callback]()
				: this.submit();
		},
		fetch(url, params) {
			return axios.get(url, { params });
		},
		fetchTemplate() {
			this.states.loading = true;
			this.states.requestType = 'fetchTemplate';

			this.fetch(this.apiEndpoints.getTemplate, this.mailchimp)
				.then((res) => {
					Object.assign(res.data, this.mailchimp);
					this.currentStep = 'checkMail';
				})
				.then(() => {
					this.states.loading = false;
				});
		},
		implementQueryInfomation(string) {
			// Insert id and mail info from url in mailchimp object
			let splitValue = null;
			let isMailOrId = null;
			let key = null;

			string.slice(1).split('&').forEach((item) => {
				splitValue = item.split('=');
				key = splitValue[0];
				isMailOrId = key === 'email' || key === 'id';

				if (isMailOrId) {
					this.mailchimp[key] = splitValue[1];
				}
			});
		},
		initiateLoading(requestType) {
			this.states.loading = true;
			this.states.requestType = requestType;
		},
		validatedForm() {
			const errorAttributeOnForm = this.$refs.formElement.getAttribute('has-error');
			let errorPresent = !!Object.keys(SkyMailchimpState)
				.find(key => SkyMailchimpState[key] === false);

			if (this.mailchimp.groups) {
				const nodelist = this.$el.querySelectorAll('.checkboxes');

				// Check if any checkbox is selected
				const checkboxSelected = this.mailchimp.groups.reduce((acc, cur) => {
					cur.items.forEach((checkbox) => {
						acc = checkbox.checked || acc;
					});

					return acc;
				}, false);

				if (!checkboxSelected) {
					// If no checkbox is selected set errorPresent to true
					errorPresent = true;

					for (let i = 0; i < nodelist.length; i++) {
						nodelist[i].setAttribute('has-error', '');
					}
				} else {
					for (let i = 0; i < nodelist.length; i++) {
						nodelist[i].removeAttribute('has-error');
					}
				}
			}

			if (errorPresent) {
				if (!errorAttributeOnForm) {
					this.$refs.formElement.setAttribute('has-error', '');
				}
			} else if (errorAttributeOnForm !== null) {
				this.$refs.formElement.removeAttribute('has-error');
			}

			return !errorPresent;
		},
		requestUpdateLink() {
			this.initiateLoading('requestUpdateLink');

			const { contextId, listId, email } = this.mailchimp;

			axios.get(this.apiEndpoints.sendUpdateLink, {
				params: {
					contextId,
					listId,
					email,
				},
			})
				.then(() => {
					this.states.requestedUpdateLink = true;
				})
				.then(() => {
					this.states.loading = false;
				});
		},
		checkMail() {
			if (this.validatedForm()) {
				this.initiateLoading('checkMail');

				// Adding subscriberId only if present in URL
				const { listId, contextId, email, id } = this.mailchimp;

				const params = id === undefined
					? { listId, contextId, email }
					: { listId, contextId, email, subscriberId: id };

				this.fetch(this.apiEndpoints.getSubscriber, params)
					.then((res) => {
						Object.assign(this.mailchimp, res.data);

						this.currentStep = 'submit';
						this.mailChecked = true;
					}, (err) => {
						if (err.response && err.response.status) {
							this.states.unauthorized = err.response.status === 401;
							this.currentStep = 'updateLink';
							this.mailChecked = true;
						}
					})
					.then(() => {
						this.states.loading = false;
					});
			}
		},
		submit() {
			if (this.validatedForm()) {
				this.initiateLoading('submit');

				axios({
					url: this.apiEndpoints.action,
					method: 'POST',
					data: this.mailchimp,
					headers: {
						'Content-Type': 'application/json',
					},
				}).then(() => {
					this.states.success = true;
				}, () => {
					this.states.error = true;
				}).then(() => {
					this.states.submitted = true;
					this.states.loading = false;
				});
			}
		},
		toggleCheckbox(groupId, index) {
			// TODO: Can this be refactored to use v-model in vue?
			this.mailchimp.groups.forEach((group, groupIndex) => {
				if (group.id === groupId) {
					const clickedCheckBox = this.mailchimp.groups[groupIndex].items[index];
					this.$set(clickedCheckBox, 'checked', !clickedCheckBox.checked);
				}
			});

			this.validatedForm();
		},
	},
};