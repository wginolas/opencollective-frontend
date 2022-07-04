import React from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';

import Container from './Container';
import Image from './Image';
import StyledButton from './StyledButton';
import StyledModal, { ModalBody, ModalFooter, ModalHeader } from './StyledModal';

/*
 * A image preview modal that can be used to display a preview image for a
 * an Email Template or an Invoice Receipt.
 */
const PreviewModal = ({ previewImage, alt, onClose }) => {
  return (
    <StyledModal onClose={onClose} trapFocus>
      <ModalHeader mb={3}>
        <FormattedMessage defaultMessage="Receipt preview" />
      </ModalHeader>
      <ModalBody mb={0}>
        <Image src={previewImage} alt={alt} height="548.6px" width="667px" />
      </ModalBody>
      <ModalFooter>
        <Container display="flex" justifyContent="center">
          <StyledButton buttonStyle="secondary" onClick={onClose}>
            <FormattedMessage id="Close" defaultMessage="Close" />
          </StyledButton>
        </Container>
      </ModalFooter>
    </StyledModal>
  );
};

PreviewModal.propTypes = {
  previewImage: PropTypes.string,
  alt: PropTypes.string,
  onClose: PropTypes.func,
};

export default PreviewModal;
