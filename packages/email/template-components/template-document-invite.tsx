import { useLingui } from '@lingui/react';
import { OrganisationType, RecipientRole } from '@prisma/client';
import { P, match } from 'ts-pattern';

import { RECIPIENT_ROLES_DESCRIPTION } from '@documenso/lib/constants/recipient-roles';

import { Button, Section, Text } from '../components';
import { TemplateDocumentImage } from './template-document-image';

export interface TemplateDocumentInviteProps {
  inviterName: string;
  inviterEmail: string;
  documentName: string;
  signDocumentLink: string;
  assetBaseUrl: string;
  role: RecipientRole;
  selfSigner: boolean;
  teamName?: string;
  includeSenderDetails?: boolean;
  organisationType?: OrganisationType;
}

export const TemplateDocumentInvite = ({
  inviterName,
  documentName,
  signDocumentLink,
  assetBaseUrl,
  role,
  selfSigner,
  teamName,
  includeSenderDetails,
  organisationType,
}: TemplateDocumentInviteProps) => {
  const { _ } = useLingui();

  const action = _(RECIPIENT_ROLES_DESCRIPTION[role].actionVerb).toLowerCase();

  const headingText = match({ selfSigner, organisationType, includeSenderDetails, teamName })
    .with({ selfSigner: true }, () => `Please ${action} your document`)
    .with(
      {
        organisationType: OrganisationType.ORGANISATION,
        includeSenderDetails: true,
        teamName: P.string,
      },
      () => `${inviterName} on behalf of "${teamName}" has invited you to ${action}`,
    )
    .with(
      { organisationType: OrganisationType.ORGANISATION, teamName: P.string },
      () => `${teamName} has invited you to ${action}`,
    )
    .otherwise(() => `${inviterName} has invited you to ${action}`);

  const subtitleText = match(role)
    .with(RecipientRole.SIGNER, () => 'Continue by signing the document.')
    .with(RecipientRole.VIEWER, () => 'Continue by viewing the document.')
    .with(RecipientRole.APPROVER, () => 'Continue by approving the document.')
    .with(RecipientRole.CC, () => '')
    .with(RecipientRole.ASSISTANT, () => 'Continue by assisting with the document.')
    .exhaustive();

  const buttonText = match(role)
    .with(RecipientRole.SIGNER, () => 'View Document to sign')
    .with(RecipientRole.VIEWER, () => 'View Document')
    .with(RecipientRole.APPROVER, () => 'View Document to approve')
    .with(RecipientRole.CC, () => '')
    .with(RecipientRole.ASSISTANT, () => 'View Document to assist')
    .exhaustive();

  return (
    <>
      <TemplateDocumentImage className="mt-6" assetBaseUrl={assetBaseUrl} />

      <Section>
        <Text className="mx-auto mb-0 max-w-[80%] text-center text-lg font-semibold text-primary">
          {headingText}
          <br />
          &quot;{documentName}&quot;
        </Text>

        <Text className="my-1 text-center text-base text-slate-400">{subtitleText}</Text>

        <Section className="mb-6 mt-8 text-center">
          <Button
            className="text-sbase inline-flex items-center justify-center rounded-lg bg-documenso-500 px-6 py-3 text-center font-medium text-black no-underline"
            href={signDocumentLink}
          >
            {buttonText}
          </Button>
        </Section>
      </Section>
    </>
  );
};

export default TemplateDocumentInvite;
