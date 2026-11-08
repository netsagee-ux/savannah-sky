type Enquiry = { id: string; name: string; email: string; message: string; created_at: string };

export default function EnquiryInbox({ enquiries }: { enquiries: Enquiry[] }) {
  return <section className="admin-section">
    <h2>Course enquiries</h2>
    {enquiries.length ? enquiries.map(enquiry => (
      <article className="academy-enquiry" key={enquiry.id}>
        <h3>{enquiry.name}</h3>
        <time dateTime={enquiry.created_at}>{new Date(enquiry.created_at).toLocaleDateString('en-GB')}</time>
        <p>{enquiry.message}</p>
        <a className="underlink" href={'mailto:' + encodeURIComponent(enquiry.email) + '?subject=Your%20Savannah%20Sky%20course%20enquiry'}>Reply to {enquiry.email}</a>
      </article>
    )) : <p>New student enquiries will appear here.</p>}
  </section>;
}
