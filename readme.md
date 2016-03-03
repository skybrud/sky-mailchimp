# sky-mailchimp

Angular-module to subscribing to mailchimp-newsletters

Please refer to the code-files for usage and documentation!

### Example
This is an example of how to implement sky-mailchimp directive in form markup:

```html
<form action="/umbraco/api/MailChimpSubscriberApi/PostSubscriber" sky-mailchimp id="mailChimpId" ng-init="skyMailchimpCtrl.mailchimp.custom = 'initialize custom props here';">
	<fieldset ng-if="!skyMailchimpCtrl.success">
		<input ng-model="skyMailchimpCtrl.mailchimp.name" name="name" placeholder="Dit navn" />
		<input ng-model="skyMailchimpCtrl.mailchimp.email" name="email" placeholder="Email-adresse" />
		<input type="hidden" ng-model="skyMailchimpCtrl.mailchimp.mailChimpId" name="mailChimpId" />
		<button>Tilmeld</button>
		<div ng-bind="skyMailchimpCtrl.error" ng-if="skyMailchimpCtrl.error"></div>
	</fieldset>
	<div ng-if="skyMailchimpCtrl.success">Tak for din tilmeling!</div>
</form>
```

### Credits

This module is made by the Frontenders at [skybrud.dk](http://www.skybrud.dk/). Feel free to use it in any way you want. Feedback, questions and bugreports should be posted as issues. Pull-requests appreciated!
