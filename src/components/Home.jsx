import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
import { Paragraph, InlineLink } from '../styles';

const listSx = {
    m: 0,
    pl: 2.25,
    '& li': { mb: 0.75 },
};

const Home = () => {
    const { pathname } = useLocation();
    const theme = useTheme();
    const br = `${theme.shape.borderRadius}px`;

    return (
        <Stack component="article" spacing={3}>
            <Helmet>
                <title>Carwoods — Houston rentals & property management</title>
                <meta
                    name="description"
                    content="Carwoods helps Houston renters find a place to call home and gives landlords full-service property management—applications, maintenance, and local expertise."
                />
            </Helmet>

            <Box
                sx={{
                    position: 'relative',
                    borderRadius: br,
                    overflow: 'hidden',
                    py: { xs: 3, sm: 4 },
                    px: { xs: 2.5, sm: 4 },
                }}
            >
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 0,
                        background: [
                            `repeating-linear-gradient(
                105deg,
                var(--home-corduroy-rib-gloss) 0 1px,
                transparent 1px 11px
              )`,
                            `repeating-linear-gradient(
                105deg,
                var(--home-corduroy-stripe-a) 0 10px,
                var(--home-corduroy-stripe-b) 10px 20px,
                var(--home-corduroy-stripe-c) 20px 30px,
                var(--home-corduroy-stripe-a) 30px 40px
              )`,
                        ].join(', '),
                    }}
                />
                <Stack spacing={1.75} sx={{ position: 'relative', zIndex: 1 }}>
                    <Typography
                        component="h1"
                        variant="h1"
                        sx={{
                            color: 'var(--home-hero-text)',
                            fontSize: { xs: '1.85rem', sm: '2.35rem', md: '2.65rem' },
                            fontWeight: 700,
                            lineHeight: 1.15,
                            textWrap: 'balance',
                        }}
                    >
                        Houston homes with texture—rentals and management that feel{' '}
                        <Box component="span" sx={{ color: 'var(--home-hero-accent)' }}>
                            broken-in, not broken-down
                        </Box>
                        .
                    </Typography>
                    <Typography
                        sx={{
                            color: 'var(--home-hero-subtext)',
                            fontSize: '1.15rem',
                            lineHeight: 1.55,
                            maxWidth: '42rem',
                            textWrap: 'balance',
                        }}
                    >
                        Carwoods is the crew renters trust for clear applications and steady communication,
                        and the partner landlords lean on when they want rent collected, maintenance handled,
                        and their asset treated like more than a line on a spreadsheet.
                    </Typography>
                    <Typography
                        sx={{
                            color: 'var(--home-hero-accent)',
                            fontWeight: 600,
                            fontSize: '1rem',
                            letterSpacing: '0.02em',
                        }}
                    >
                        Corduroy-comfort service. Denim-durable follow-through.
                    </Typography>
                </Stack>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} useFlexGap flexWrap="wrap">
                <Paper
                    elevation={0}
                    sx={{
                        flex: '1 1 300px',
                        p: 2.5,
                        backgroundColor: 'var(--home-audience-card-bg)',
                        border: '1px solid var(--home-audience-card-border)',
                        backgroundImage: 'none',
                    }}
                >
                    <Typography
                        component="h2"
                        variant="h2"
                        sx={{
                            mt: 0,
                            mb: 1,
                            pb: 0.5,
                            color: 'primary.main',
                            borderBottom: 2,
                            borderColor: 'primary.light',
                            fontSize: { xs: '1.35rem', sm: '1.5rem' },
                        }}
                    >
                        Renters
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                        Looking for a lease in Houston? We keep the path honest: what you need to apply, what
                        to expect, and people who pick up the phone.
                    </Typography>
                    <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                        <li>Streamlined application steps and required-documents guidance</li>
                        <li>Local listings mindset—we know this market&apos;s rhythms</li>
                        <li>Respect for your time: fewer surprises, clearer next steps</li>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            component={Link}
                            to={withDarkPath(pathname, '/apply')}
                            variant="contained"
                            color="primary"
                            size="large"
                            sx={{ fontWeight: 700 }}
                        >
                            Start your application
                        </Button>
                    </Box>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        flex: '1 1 300px',
                        p: 2.5,
                        backgroundColor: 'var(--home-audience-card-bg)',
                        border: '1px solid var(--home-audience-card-border)',
                        backgroundImage: 'none',
                    }}
                >
                    <Typography
                        component="h2"
                        variant="h2"
                        sx={{
                            mt: 0,
                            mb: 1,
                            pb: 0.5,
                            color: 'primary.main',
                            borderBottom: 2,
                            borderColor: 'primary.light',
                            fontSize: { xs: '1.35rem', sm: '1.5rem' },
                        }}
                    >
                        Landlords & owners
                    </Typography>
                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                        Hand us the keys to the busywork. We market vacancies, screen tenants, coordinate
                        repairs, and report back so you can stay focused on the big picture.
                    </Typography>
                    <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                        <li>Full-service property management tailored to your goals</li>
                        <li>Maintenance coordination and vendor relationships</li>
                        <li>Steady communication—you&apos;re never guessing what&apos;s happening</li>
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <Button
                            component={Link}
                            to={withDarkPath(pathname, '/property-management')}
                            variant="outlined"
                            color="primary"
                            size="large"
                            sx={{ fontWeight: 700 }}
                        >
                            Explore property management
                        </Button>
                    </Box>
                </Paper>
            </Stack>

            <Paragraph sx={{ textAlign: 'center', mb: 0 }}>
                <InlineLink href={withDarkPath(pathname, '/contact-us')}>Contact us</InlineLink>
                {' — '}questions welcome, pressure not included.
            </Paragraph>
        </Stack>
    );
};

export default Home;
