import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import DomainOutlined from '@mui/icons-material/DomainOutlined';
import HomeWorkOutlined from '@mui/icons-material/HomeWorkOutlined';
import { withDarkPath } from '../routePaths';
import { Helmet } from 'react-helmet';
import { Heading, Button } from '../styles';

const listSx = {
    m: 0,
    pl: 2.25,
    '& li': { mb: 0.75 },
};

const audienceTitleSx = {
    mt: 0,
    mb: 1,
    pb: 0.5,
    color: 'primary.main',
    borderBottom: 2,
    borderColor: 'primary.light',
    fontSize: { xs: '1.35rem', sm: '1.5rem' },
    fontWeight: 700,
};

const audienceCardSx = (theme) => ({
    flex: '1 1 300px',
    p: 2.75,
    bgcolor: 'background.paper',
    border: 1,
    borderColor: 'divider',
    borderLeftWidth: 5,
    borderLeftColor: 'primary.main',
    borderRadius: 2,
    backgroundImage: 'none',
    boxShadow:
        theme.palette.mode === 'dark'
            ? `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`
            : `0 10px 28px ${alpha(theme.palette.primary.main, 0.08)}`,
    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
    '@media (hover: hover)': {
        '&:hover': {
            boxShadow:
                theme.palette.mode === 'dark'
                    ? `0 12px 32px ${alpha(theme.palette.common.black, 0.45)}`
                    : `0 14px 36px ${alpha(theme.palette.primary.main, 0.14)}`,
            transform: 'translateY(-2px)',
        },
    },
});

const HIGHLIGHTS = [
    { label: 'Houston market focus', detail: 'Local leasing rhythms, not generic playbooks' },
    { label: 'Operations you can feel', detail: 'Applications, rent, and maintenance in one flow' },
    { label: 'Communication that holds', detail: 'Fewer gaps, clearer next steps' },
];

const Home = () => {
    const theme = useTheme();
    const { pathname } = useLocation();
    const heroTint = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.08);
    const heroBorder = alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.35 : 0.22);

    return (
        <Stack component="article" spacing={3.5}>
            <Helmet>
                <title>Carwoods — Houston rentals, managed right</title>
                <meta
                    name="description"
                    content="Houston rentals and property management: clear applications, consistent communication, on-time rent collection, proactive maintenance, and disciplined asset care."
                />
            </Helmet>

            <Box
                sx={{
                    px: { xs: 2.25, sm: 3.5 },
                    py: { xs: 3, sm: 4 },
                    borderRadius: 2,
                    bgcolor: heroTint,
                    border: '1px solid',
                    borderColor: heroBorder,
                    backgroundImage: `linear-gradient(135deg, ${heroTint} 0%, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.06 : 0.02)} 100%)`,
                }}
            >
                <Heading>Houston Rentals, Managed Right</Heading>
                <Typography
                    variant="subtitle1"
                    component="p"
                    sx={{
                        mt: 0,
                        mb: 1.25,
                        maxWidth: 'md',
                        fontWeight: 600,
                        color: 'text.primary',
                        lineHeight: 1.45,
                    }}
                >
                    Clear applications. Consistent communication. On-time rent collection, proactive
                    maintenance, and disciplined asset care.
                </Typography>
            </Box>

            <Stack
                component="section"
                aria-label="Company highlights"
                direction={{ xs: 'column', sm: 'row' }}
                spacing={0}
                sx={{
                    py: 2.25,
                    px: { xs: 0, sm: 0.5 },
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.04),
                    border: '1px solid',
                    borderColor: 'divider',
                }}
            >
                {HIGHLIGHTS.map((item, index) => (
                    <Box
                        key={item.label}
                        sx={{
                            flex: '1 1 0',
                            px: { xs: 2, sm: 2.5 },
                            py: { xs: 1.5, sm: 1 },
                            textAlign: { xs: 'left', sm: 'center' },
                            borderLeft:
                                index > 0
                                    ? { xs: 'none', sm: '1px solid' }
                                    : 'none',
                            borderTop:
                                index > 0 ? { xs: '1px solid', sm: 'none' } : 'none',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            sx={{
                                fontWeight: 800,
                                color: 'primary.main',
                                letterSpacing: 0.02,
                                textTransform: 'uppercase',
                                fontSize: '0.8rem',
                            }}
                        >
                            {item.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {item.detail}
                        </Typography>
                    </Box>
                ))}
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.75} useFlexGap flexWrap="wrap">
                <Paper elevation={0} sx={audienceCardSx(theme)}>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                        <HomeWorkOutlined
                            sx={{
                                fontSize: 40,
                                color: 'primary.main',
                                opacity: 0.95,
                            }}
                            aria-hidden
                        />
                        <Typography component="h2" variant="h2" sx={audienceTitleSx}>
                            Renters
                        </Typography>
                    </Stack>
                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                        Looking for a lease in Houston? We keep the path honest: what you need to apply, what
                        to expect, and people who pick up the phone.
                    </Typography>
                    <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                        <li>Streamlined application steps and required-documents guidance</li>
                        <li>Local listings mindset—we know this market&apos;s rhythms</li>
                        <li>Respect for your time: fewer surprises, clearer next steps</li>
                    </Box>
                    <Box sx={{ mt: 2.5 }}>
                        <Button as={Link} to={withDarkPath(pathname, '/apply')}>
                            Start your application
                        </Button>
                    </Box>
                </Paper>

                <Paper elevation={0} sx={audienceCardSx(theme)}>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
                        <DomainOutlined
                            sx={{
                                fontSize: 40,
                                color: 'primary.main',
                                opacity: 0.95,
                            }}
                            aria-hidden
                        />
                        <Typography component="h2" variant="h2" sx={audienceTitleSx}>
                            Landlords & owners
                        </Typography>
                    </Stack>
                    <Typography color="text.secondary" sx={{ mb: 1.5 }}>
                        Hand us the keys to the busywork. We market vacancies, screen tenants, coordinate
                        repairs, and report back so you can stay focused on the big picture.
                    </Typography>
                    <Box component="ul" sx={{ ...listSx, color: 'text.secondary' }}>
                        <li>Full-service property management tailored to your goals</li>
                        <li>Maintenance coordination and vendor relationships</li>
                        <li>Steady communication—you&apos;re never guessing what&apos;s happening</li>
                    </Box>
                    <Box sx={{ mt: 2.5 }}>
                        <Button as={Link} to={withDarkPath(pathname, '/property-management')}>
                            Explore property management
                        </Button>
                    </Box>
                </Paper>
            </Stack>
        </Stack>
    );
};

export default Home;
