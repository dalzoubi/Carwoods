import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
import { Paragraph, InlineLink, Button } from '../styles';

const listSx = {
    m: 0,
    pl: 2.25,
    '& li': { mb: 0.75 },
};

const Home = () => {
    const { pathname } = useLocation();

    return (
        <Stack component="article" spacing={3}>
            <Helmet>
                <title>Carwoods — Houston rentals & property management</title>
                <meta
                    name="description"
                    content="Carwoods helps Houston renters find a place to call home and gives landlords full-service property management—applications, maintenance, and local expertise."
                />
            </Helmet>

            <Stack spacing={1.75} sx={{ py: { xs: 0.5, sm: 1 } }}>
                <Typography
                    component="h1"
                    variant="h1"
                    sx={{
                        color: 'text.primary',
                        fontSize: { xs: '1.85rem', sm: '2.35rem', md: '2.65rem' },
                        fontWeight: 700,
                        lineHeight: 1.15,
                        textWrap: 'balance',
                    }}
                >
                    Houston homes with texture—rentals and management that feel{' '}
                    <Box component="span" sx={{ color: 'secondary.main' }}>
                        broken-in, not broken-down
                    </Box>
                    .
                </Typography>
                <Typography
                    color="text.secondary"
                    sx={{
                        fontSize: '1.15rem',
                        lineHeight: 1.55,
                        maxWidth: '42rem',
                        textWrap: 'balance',
                    }}
                >
                    Carwoods is the crew renters trust for clear applications and steady communication, and the
                    partner landlords lean on when they want rent collected, maintenance handled, and their asset
                    treated like more than a line on a spreadsheet.
                </Typography>
                <Typography
                    sx={{
                        color: 'secondary.main',
                        fontWeight: 600,
                        fontSize: '1rem',
                        letterSpacing: '0.02em',
                    }}
                >
                    Corduroy-comfort service. Denim-durable follow-through.
                </Typography>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} useFlexGap flexWrap="wrap">
                <Paper
                    elevation={0}
                    sx={{
                        flex: '1 1 300px',
                        p: 2.5,
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
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
                        <Button as={Link} to={withDarkPath(pathname, '/apply')}>
                            Start your application
                        </Button>
                    </Box>
                </Paper>

                <Paper
                    elevation={0}
                    sx={{
                        flex: '1 1 300px',
                        p: 2.5,
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
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
                        <Button as={Link} to={withDarkPath(pathname, '/property-management')}>
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
