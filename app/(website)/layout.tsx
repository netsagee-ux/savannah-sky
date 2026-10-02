import {Header,Footer} from '@/components/shell';export default function WebsiteLayout({children}:{children:React.ReactNode}){return <><Header/><main id="main">{children}</main><Footer/></>}
