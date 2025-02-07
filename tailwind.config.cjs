/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                main: 'rgb(var(--color-main) / <alpha-value>)',
                link: 'rgb(var(--color-link) / <alpha-value>)',
                // Because the secondary and bg color values are fixed alpha values in the design, the css variable is used directly.
                secondary: 'var(--color-second)',
                bg: 'var(--color-second)',
                primaryMain: 'var(--color-main1)',
                textMain: '#181818',
                lightBg: '#F9F9F9',
                lightSecond: '#767F8D',
                lightLineSecond: '#E6E7E8',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
            },
        },
        screens: {
            sm: '640px',
            md: '990px',
            lg: '1265px',
        },
    },
    plugins: [require('@tailwindcss/forms')],
};
