import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { PaymentIntent } from '@stripe/stripe-js';

interface PaymentFormProps {
    onSuccess: (paymentIntent?: PaymentIntent) => void;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${window.location.origin}/order-confirmation`,
            },
            redirect: 'if_required',
        });

        if (error) {
            setErrorMessage(error.message || 'An unexpected error occurred.');
            setIsProcessing(false);
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onSuccess(paymentIntent);
        } else {
            // Handle other payment statuses (e.g., processing, requires_action)
        }

        setIsProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit}>
            <PaymentElement />
            <button type="submit" disabled={!stripe || isProcessing} className="w-full bg-black text-white font-bold py-3 rounded-md mt-6 hover:bg-gray-800">
                {isProcessing ? 'Procesando...' : 'Pagar'}
            </button>
            {errorMessage && <div className="text-red-500 mt-2">{errorMessage}</div>}
        </form>
    );
};

export default PaymentForm;